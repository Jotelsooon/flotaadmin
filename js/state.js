// Centralized mutable state — import and mutate this object directly.
// Never re-create it; mutate in-place so all modules share the same reference.

export const state = {
  profile:      null,   // { id, email, nombre, rol, titular_id }
  pendingUser:  null,   // auth.user when perfiles row missing (for pending screen)
  moviles:      [],     // [{ id, numero, descripcion, reparto_tipo, ... }]
  historialRows: [],    // [{ id, fecha, turno, movil_id, movil_numero, ... }]
  chartBar:     null,   // Chart.js bar instance
  chartDoughnut: null,  // Chart.js doughnut instance
};
