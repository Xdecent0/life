// What an app has to say about itself before the shared machinery can run it.
//
// The core knows how to keep state, merge it record by record, sync it through a
// private repository and draw a shell around it. It knows nothing about food,
// cleaning or devices. Everything app-specific arrives through here — once, at
// boot — so a new app is a manifest plus screens rather than a fork of the last
// one.

let current = null;

/**
 * Declare the running app.
 *
 * @param {object} manifest
 * @param {string} manifest.key      short id: storage prefix, folder in the data repo, status file name
 * @param {string} manifest.name     what the person calls it
 * @param {object} manifest.empty    the shape of a state with nothing in it
 * @param {object} manifest.paths    collection name → path inside the data repo
 * @param {(string|object)[]} manifest.collections  which of those merge record by record
 * @param {object[]} [manifest.singles]    one-blob files with their own idea of merging
 * @param {object} [manifest.references]   name → markdown path read from the vault
 */
export function declare(manifest) {
  if (!manifest?.key) throw new Error("приложению нужен key");
  if (!manifest.empty) throw new Error("приложению нужно пустое состояние");

  current = {
    references: {},
    collections: [],
    singles: [],
    paths: {},
    ...manifest,
    /* A collection is a name, or a name with a rule for ageing its own entries.
       Normalising here means the sync loop reads one shape and every manifest
       keeps writing the short form where it has nothing extra to say. */
    collections: (manifest.collections ?? []).map((entry) =>
      typeof entry === "string" ? { key: entry } : entry
    ),
    storageKey: `${manifest.key}.state.v1`,
    /* One origin serves every app on this account, so localStorage is shared.
       That is a gift — the access key is entered once and works everywhere — but
       only if each app namespaces its own state and leaves the shared keys alone. */
    logKey: `${manifest.key}.log.v1`,
  };

  return current;
}

/** The manifest, for the parts of the core that need it. Throws rather than guessing. */
export function app() {
  if (!current) throw new Error("приложение не объявлено: сначала declare()");
  return current;
}

export const declared = () => current !== null;

/** The folder this app owns inside the shared data repository. */
export const folder = (name = app().key) => FOLDERS[name] ?? name;

/* The repo is read by a person in a file browser, so its folders carry the names
   the person uses, not the keys the code does. */
const FOLDERS = {
  kitchen: "Кухня",
  clean: "Уборка",
  things: "Вещи",
  places: "Места",
};
