// Import this in a test file whose games start with no wings formed
// (formStartWings skipped), so the test places its own. Vitest isolates
// each test file, so this reaches no other file.
import { newGameAirModel } from "@openfront/engine/ww1936/air/WwAir";

newGameAirModel.startWings = false;
