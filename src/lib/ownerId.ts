export function getOwnerId(): string {
  try {
    const raw = localStorage.getItem('lumo_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u?.id) {
        // Keep lumo_owner_id synchronized with authenticated user id
        localStorage.setItem('lumo_owner_id', u.id);
        return u.id;
      }
    }
  } catch {}
  let id = localStorage.getItem('lumo_owner_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('lumo_owner_id', id);
  }
  return id;
}
