// Import this in a test file of the old air model. New games in that file
// start with the switch off, whatever WW_WINGS_LIVE says, and liveWings can
// still turn one game on after its start with no wings formed. Vitest isolates
// each test file, so this reaches no other file. It goes when the old model is
// removed.
import { newGameAirModel } from "@openfront/engine/ww1936/air/WwAir";

newGameAirModel.wingsLive = false;
