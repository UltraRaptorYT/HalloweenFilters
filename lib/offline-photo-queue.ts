export type QueuedPhoto = {
  id: string;
  filterId: string;
  createdAt: number;
  blob: Blob;
};

const databaseName = "afterglow-booth";
const storeName = "queued-photos";
const databaseVersion = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local photo queue."));
  });
}

export async function saveQueuedPhoto(photo: QueuedPhoto): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(photo);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the photo on this booth."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not save the photo on this booth."));
  });
  database.close();
}

export async function getQueuedPhotos(): Promise<QueuedPhoto[]> {
  const database = await openDatabase();
  const photos = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as QueuedPhoto[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read the local photo queue."));
  });
  database.close();
  return photos.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeQueuedPhoto(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove the synced photo from this booth."));
  });
  database.close();
}
