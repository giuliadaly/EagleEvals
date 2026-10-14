import base64
import importlib.util
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location('recovery', Path(__file__).with_name('recover-rmp-reviews.py'))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


def person(count):
    return {'id': base64.b64encode(b'Teacher-123').decode(), 'legacyId': 123,
            'firstName': 'Fixture', 'lastName': 'Teacher', 'numRatings': count,
            'school': {'id': recovery.SCHOOL}}


def result(teacher, ids, more=False, cursor=None):
    return {'node': {**teacher, 'ratings': {
        'edges': [{'node': {'id': str(i), 'comment': 'Fixture feedback.'}} for i in ids],
        'pageInfo': {'hasNextPage': more, 'endCursor': cursor}}}}


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        recovery.ROOT = Path(self.directory.name)
        (recovery.ROOT / 'profiles').mkdir()

    def test_zero_displayed_count_still_queries_and_preserves_available_comments(self):
        teacher = person(0)
        requests = []

        def request(query, variables):
            requests.append(variables)
            return result(teacher, [1])

        recovery.request = request
        saved = recovery.fetch_teacher(teacher)
        self.assertEqual(len(requests), 1)
        self.assertEqual(saved['reportedRatingCount'], 0)
        self.assertEqual(saved['writtenReviewCount'], 1)
        self.assertEqual(saved['pages'], 1)
        self.assertEqual(recovery.fetch_teacher(teacher), saved)
        self.assertEqual(len(requests), 1, 'a genuinely fetched checkpoint can resume')

    def test_pagination_follows_connection_instead_of_reported_count(self):
        teacher = person(1)
        pages = [result(teacher, [1, 2], True, 'cursor-two'), result(teacher, [3])]
        after = []

        def request(query, variables):
            after.append(variables['after'])
            return pages.pop(0)

        recovery.request = request
        saved = recovery.fetch_teacher(teacher)
        self.assertEqual(after, [None, 'cursor-two'])
        self.assertEqual(saved['returnedRatingCount'], 3)
        self.assertEqual(saved['writtenReviewCount'], 3)

    def test_broken_pagination_does_not_save_a_complete_profile(self):
        teacher = person(5)
        recovery.request = lambda query, variables: result(teacher, [], True, 'cursor-two')
        with self.assertRaisesRegex(ValueError, 'cursor'):
            recovery.fetch_teacher(teacher)
        self.assertFalse((recovery.ROOT / 'profiles' / '123.json.gz').exists())


if __name__ == '__main__':
    unittest.main()
