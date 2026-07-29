"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SPEC, type ThumbSpec } from "@/lib/templates.ts";
import {
  loadPeople,
  savePeople,
  newPersonId,
  type Person,
} from "@/lib/people.ts";
import ControlRail from "@/components/ControlRail";
import Preview from "@/components/Preview";
import { Notice } from "@/components/ui";

export default function EditorPage() {
  const [spec, setSpec] = useState<ThumbSpec>(DEFAULT_SPEC);
  const [people, setPeople] = useState<Person[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // localStorage is browser-only; read it after mount so SSR and the first
  // client render agree.
  useEffect(() => {
    setPeople(loadPeople());
  }, []);

  /** Writes through to storage and only updates state if the write succeeded. */
  const commitPeople = useCallback((next: Person[]) => {
    const result = savePeople(next);
    if (result.ok) {
      setPeople(next);
      return true;
    }
    setNotice(result.error);
    return false;
  }, []);

  const handleSavePerson = useCallback(() => {
    if (!spec.person.src) return;

    const existing = people.find((p) => p.src === spec.person.src);
    if (existing) {
      // Same image already saved — update its framing rather than duplicating.
      const updated = people.map((p) =>
        p.id === existing.id
          ? { ...p, scale: spec.person.scale, x: spec.person.x, y: spec.person.y }
          : p,
      );
      if (commitPeople(updated)) {
        setNotice(`Updated framing for ${existing.name}.`);
      }
      return;
    }

    const person: Person = {
      id: newPersonId(),
      name: `Person ${people.length + 1}`,
      src: spec.person.src,
      scale: spec.person.scale,
      x: spec.person.x,
      y: spec.person.y,
    };
    if (commitPeople([...people, person])) {
      setNotice(`Saved ${person.name} to your library.`);
    }
  }, [spec.person, people, commitPeople]);

  const handleDeletePerson = useCallback(
    (id: string) => {
      commitPeople(people.filter((p) => p.id !== id));
    },
    [people, commitPeople],
  );

  const handlePickPerson = useCallback((person: Person) => {
    // Restore the saved framing along with the image — that reuse is the
    // entire point of the library.
    setSpec((prev) => ({
      ...prev,
      person: {
        show: true,
        src: person.src,
        scale: person.scale,
        x: person.x,
        y: person.y,
      },
    }));
  }, []);

  return (
    <main className="flex min-h-screen">
      <ControlRail
        spec={spec}
        setSpec={setSpec}
        people={people}
        onSavePerson={handleSavePerson}
        onDeletePerson={handleDeletePerson}
        onPickPerson={handlePickPerson}
      />

      <div className="flex flex-1 flex-col">
        {notice && (
          <div className="pt-5">
            <Notice text={notice} onDismiss={() => setNotice(null)} />
          </div>
        )}
        <Preview spec={spec} />
      </div>
    </main>
  );
}
