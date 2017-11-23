const MSG_MAP_PAINT = 0;
const MSG_PLAYER_PAINT = 1;
const MSG_PLAYER_MOVE = 2;
const MSG_MAP_COL_PAINT = 3;
const MSG_PLAYER_COL_PAINT = 4;

var ws;

function comms_init() {
	ws = new WebSocket("ws://"+ location.host + "/ws");
}

function comms_move(x, y) {
	// player x and player y, floats
	ws.send(JSON.stringify({t: MSG_PLAYER_MOVE, px: x, py: y}));
}

function comms_map_draw(x, y, f, c) {
	// map cell x, y, frame, and color 
	// frame is an array of numbers
	ws.send(JSON.stringify({t: MSG_MAP_PAINT, x: x, y: y, f: f, c: c}));
}

function comms_map_col_draw(x, y, f, c) {
	// map cell x, y, frame, and color 
	// frame is an array of numbers
	ws.send(JSON.stringify({t: MSG_MAP_COL_PAINT, x: x, y: y, f: f, c: c}));
}

function comms_player_draw(x, y, f, d, c) {
	// player map cell x, y, frame, direction, and color
	// frame and direction are arrays of numbers
	ws.send(JSON.stringify({t: MSG_PLAYER_PAINT, x: x, y: y, f: f, d: d, c: c}));
}

function comms_player_col_draw(x, y, f, d, c) {
	// player map cell x, y, frame, direction, and color
	// frame and direction are arrays of numbers
	ws.send(JSON.stringify({t: MSG_PLAYER_COL_PAINT, x: x, y: y, f: f, d: d, c: c}));
}
