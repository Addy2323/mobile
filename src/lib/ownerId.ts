export function getOwnerId(): string {
  let id = localStorage.getItem('lumo_owner_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('lumo_owner_id', id);
  }
  return id;
}
