import { test, expect } from "bun:test";
import { renderToString } from "react-dom/server";
import { SaveBar } from "../app/components/SaveBar";

test("renders 'Save' when dirty", () => {
  const html = renderToString(
    <SaveBar hasChanges={true} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  expect(html).toContain(">Save<");
  expect(html).not.toContain("Saved");
});

test("renders 'Saved ✓' when clean", () => {
  const html = renderToString(
    <SaveBar hasChanges={false} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  expect(html).toContain("Saved");
  expect(html).toContain("✓");
});

test("always renders Save As New", () => {
  const clean = renderToString(
    <SaveBar hasChanges={false} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  const dirty = renderToString(
    <SaveBar hasChanges={true} onSave={() => {}} onSaveAsNew={() => {}} />
  );
  expect(clean).toContain("Save As New");
  expect(dirty).toContain("Save As New");
});
