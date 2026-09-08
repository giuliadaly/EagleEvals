"use client";

import { useState } from "react";

export function SemesterPicker({ currentYear }: { currentYear: number }) {
  const [semester, setSemester] = useState("");
  const [olderYear, setOlderYear] = useState("");
  const [olderTerm, setOlderTerm] = useState("");
  const recent = Array.from({ length: 4 }, (_, index) => currentYear - index);
  const earlier = Array.from({ length: Math.max(0, currentYear - 2003) }, (_, index) => currentYear - 4 - index);
  const value = semester === "older" ? (olderTerm && olderYear ? `${olderTerm} ${olderYear}` : "") : semester;
  return <div>
    <input type="hidden" name="semester" value={value} />
    <label><span className="form-label">Semester taken</span><select className="form-control" value={semester} onChange={event => setSemester(event.target.value)} required>
      <option value="" disabled>Choose your semester</option>
      {recent.map(year => <optgroup label={String(year)} key={year}>{["Fall", "Summer", "Spring"].map(term => <option key={term} value={`${term} ${year}`}>{term} {year}</option>)}</optgroup>)}
      <option value="older">An earlier semester…</option>
    </select></label>
    {semester === "older" ? <div className="mt-4 grid grid-cols-2 gap-3">
      <label><span className="form-label">Term</span><select className="form-control" value={olderTerm} onChange={event => setOlderTerm(event.target.value)} required><option value="" disabled>Choose term</option>{["Fall", "Summer", "Spring"].map(term => <option key={term}>{term}</option>)}</select></label>
      <label><span className="form-label">Year taken</span><select className="form-control" value={olderYear} onChange={event => setOlderYear(event.target.value)} required><option value="" disabled>Choose year</option>{earlier.map(year => <option key={year}>{year}</option>)}</select></label>
    </div> : null}
  </div>;
}
