"""Resumable BC-only recovery. Stores no reviewer accounts or identities."""
import concurrent.futures
import argparse
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path
import tempfile
import threading
import time
import urllib.error
import urllib.request

SCHOOL = 'U2Nob29sLTEyMg=='
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', help='Private snapshot folder outside the repository; reuse to resume')
options = parser.parse_args() if __name__ == '__main__' else parser.parse_args([])
ROOT = Path(options.output or os.environ.get('RMP_SNAPSHOT_PATH') or tempfile.mkdtemp(prefix='eagleevals-rmp-bc-'))
if ROOT.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
    raise ValueError('Raw recovery snapshots must remain outside the repository')
ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
(ROOT / 'profiles').mkdir(mode=0o700, exist_ok=True)
lock = threading.Lock()
stop = threading.Event()
last_request = 0.0
requests = 0

INDEX_QUERY = '''query EagleEvalsSchoolRecovery($schoolID:ID!,$after:String,$text:String!){newSearch{teachers(query:{text:$text,schoolID:$schoolID},first:100,after:$after){resultCount edges{node{id legacyId firstName lastName numRatings department school{id name}}} pageInfo{hasNextPage endCursor}}}}'''
REVIEWS_QUERY = '''query EagleEvalsFullReviewRecovery($id:ID!,$after:String){node(id:$id){... on Teacher{id legacyId firstName lastName department numRatings school{id name} ratings(first:100,after:$after){edges{node{id legacyId class comment date wouldTakeAgain helpfulRating clarityRating difficultyRating}} pageInfo{hasNextPage endCursor}}}}}'''


class FatalAccessError(Exception): pass


def save(path, value, compressed=False):
    raw = (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    if compressed: raw = gzip.compress(raw, mtime=0)
    temporary = path.with_suffix(path.suffix + '.tmp')
    with open(temporary, 'wb') as f:
        os.fchmod(f.fileno(), 0o600)
        f.write(raw)
    os.replace(temporary, path)
    return hashlib.sha256(raw).hexdigest()


def request(query, variables):
    global last_request, requests
    for attempt in range(3):
        if stop.is_set(): raise FatalAccessError('Stopped after an access or schema failure')
        with lock:
            delay = max(0, .35 - (time.monotonic() - last_request))
            if delay: time.sleep(delay)
            last_request = time.monotonic()
            requests += 1
        req = urllib.request.Request('https://www.ratemyprofessors.com/graphql',
            data=json.dumps({'query': query, 'variables': variables}).encode(),
            headers={'Content-Type':'application/json', 'Authorization':'Basic dGVzdDp0ZXN0', 'User-Agent':'EagleEvals/1.0 (+https://eagleevals.com)'})
        try:
            with urllib.request.urlopen(req, timeout=30) as response: result = json.load(response)
            if result.get('errors'):
                stop.set()
                raise FatalAccessError('GraphQL rejected the recovery query: ' + json.dumps(result['errors'])[:500])
            if not isinstance(result.get('data'), dict): raise ValueError('Missing GraphQL data')
            return result['data']
        except urllib.error.HTTPError as error:
            if error.code in (401, 403):
                stop.set()
                raise FatalAccessError('Provider denied access; no bypass attempted')
            if error.code == 429:
                if attempt == 2: raise
                time.sleep(min(45, max(5, int(error.headers.get('Retry-After', '10')))))
            elif error.code >= 500 and attempt < 2: time.sleep(2 ** (attempt + 1))
            else: raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2: raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError('Request did not complete')


def fetch_index():
    target = ROOT / 'teachers.json'
    if target.exists(): return json.loads(target.read_text())
    after = None
    seen = set()
    teachers = {}
    pages = 0
    passes = 1
    while True:
        connection = request(INDEX_QUERY, {'schoolID': SCHOOL, 'after': after, 'text':'' if passes == 1 else '*'})['newSearch']['teachers']
        for edge in connection['edges']:
            teacher = edge['node']
            if teacher['school']['id'] != SCHOOL: raise FatalAccessError('Wrong school in index')
            if not isinstance(teacher['legacyId'], int) or teacher['legacyId'] <= 0:
                raise FatalAccessError('Invalid source teacher ID')
            teachers[teacher['id']] = teacher
        pages += 1
        print(json.dumps({'stage':'index', 'profiles':len(teachers), 'reportedTotal':connection['resultCount'], 'pages':pages}), flush=True)
        info = connection['pageInfo']
        if not info['hasNextPage']:
            if len(teachers) < connection['resultCount'] and passes == 1:
                passes = 2
                after = None
                seen.clear()
                continue
            break
        after = info['endCursor']
        if not after or after in seen: raise FatalAccessError('Index cursor did not advance')
        seen.add(after)
    data = {'schoolId':SCHOOL, 'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'reportedTotal':connection['resultCount'], 'profiles':list(teachers.values()), 'pages':pages,
        'indexCountMatches':len(teachers)==connection['resultCount'], 'indexExhausted':True}
    save(target, data)
    return data


def fetch_teacher(teacher):
    target = ROOT / 'profiles' / (str(teacher['legacyId']) + '.json.gz')
    if target.exists():
        result = json.loads(gzip.decompress(target.read_bytes()))
        if result.get('complete') and result.get('pages', 0) > 0 and result.get('teacher', {}).get('id') == teacher['id']: return result
    after = None
    seen = set()
    reviews = {}
    pages = 0
    current = teacher
    # RMP's displayed count can lag the actual connection, even at zero.
    while True:
        node = request(REVIEWS_QUERY, {'id':teacher['id'], 'after':after})['node']
        if not node or node['id'] != teacher['id'] or node['school']['id'] != SCHOOL:
            raise ValueError('Profile identity unavailable or changed')
        current = {key:value for key,value in node.items() if key != 'ratings'}
        connection = node['ratings']
        for edge in connection['edges']:
            review = edge['node']
            old = reviews.get(review['id'])
            if old and old != review: raise ValueError('Conflicting review versions during pagination')
            reviews[review['id']] = review
        pages += 1
        if not connection['pageInfo']['hasNextPage']: break
        after = connection['pageInfo']['endCursor']
        if not after or after in seen or not connection['edges']: raise ValueError('Review cursor did not advance')
        seen.add(after)
    result = {'teacher':current, 'reviews':list(reviews.values()), 'pages':pages, 'complete':True,
        'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'reportedRatingCount':current['numRatings'], 'returnedRatingCount':len(reviews),
        'writtenReviewCount':sum(bool((r.get('comment') or '').strip()) for r in reviews.values())}
    save(target, result, compressed=True)
    return result


def main():
    print(json.dumps({'snapshotPath':str(ROOT), 'rawDataInGit':False}), flush=True)
    index = fetch_index()
    completed = []
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs = {pool.submit(fetch_teacher, teacher):teacher for teacher in index['profiles']}
        for future in concurrent.futures.as_completed(jobs):
            teacher = jobs[future]
            try:
                result = future.result()
                completed.append({'id':teacher['id'], 'legacyId':teacher['legacyId'], 'ratings':result['returnedRatingCount'], 'written':result['writtenReviewCount'], 'reported':result['reportedRatingCount']})
            except FatalAccessError:
                stop.set()
                for job in jobs: job.cancel()
                raise
            except Exception as error:
                failed.append({'legacyId':teacher['legacyId'], 'type':type(error).__name__})
            if (len(completed) + len(failed)) % 25 == 0:
                print(json.dumps({'stage':'reviews', 'completedProfiles':len(completed), 'failedProfiles':len(failed), 'ratings':sum(p['ratings'] for p in completed), 'written':sum(p['written'] for p in completed), 'httpRequests':requests}), flush=True)
    manifest = {'schoolId':SCHOOL, 'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'indexedProfiles':len(index['profiles']), 'completedProfiles':len(completed), 'failed':failed,
        'ratings':sum(p['ratings'] for p in completed), 'writtenReviews':sum(p['written'] for p in completed),
        'countMismatches':[p for p in completed if p['ratings'] != p['reported']], 'profiles':completed,
        'complete':not failed and len(completed)==len(index['profiles']), 'httpRequests':requests}
    save(ROOT / 'manifest.json', manifest)
    print(json.dumps({key:value for key,value in manifest.items() if key not in ('profiles','countMismatches')},ensure_ascii=False), flush=True)


if __name__ == '__main__': main()
