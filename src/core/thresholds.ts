// Bewertungsschwellen aus der SPEC (keine Fahrzeugdaten – die stehen in e46_data.json).

/** SPEC 7.5: Freigang-Ampel. */
export const CLEARANCE_GREEN_ABOVE = 10; // mm
export const CLEARANCE_RED_BELOW = 3; // mm

/** SPEC 7.6: Abstand zur Mindesthöhe unter diesem Wert = gelb. */
export const LEGAL_MARGIN_WARN = 3; // mm

/** SPEC 7.1: statischer Radius ohne Messung ≈ r − 13 mm. */
export const TIRE_DEFLECTION_DEFAULT = 13; // mm
