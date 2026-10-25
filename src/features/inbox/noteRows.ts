/** Focusable note rows in document order, skipping collapsed (inert) sections. */
export const noteRows = (scope: ParentNode) =>
  Array.from(scope.querySelectorAll<HTMLElement>("[data-note-row]")).filter(
    (row) => !row.closest("[inert]"),
  );
