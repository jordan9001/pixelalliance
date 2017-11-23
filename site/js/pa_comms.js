const MSG_MAP_PAINT = 0;
const MSG_PLAYER_PAINT = 1;
const MSG_PLAYER_MOVE = 2;
const MSG_MAP_COL_PAINT = 3;
const MSG_PLAYER_COL_PAINT = 4;
const MSG_PLAYER_REMOVE = 5;

var ws;
var comms_ready = false;
var comms_closed = true;
var comms_queue = [];

function comms_init(map_callback, player_paint_callback, player_move_callback, player_remove_callback) {
	ws = new WebSocket("ws://"+ location.host + "/ws");

	ws.onmessage = function(msg_evt) {
		msg_obj = JSON.parse(msg_obj.data);
		console.log(msg_obj);
	};

	ws.onopen = function(opn_evt) {
		comms_ready = true;
		while (comms_queue.length > 0) {
			msg = q.shift();
			ws.send(msg);
		}
	};

	ws.onerror = function(err_evt) {
		comms_closed = true;
		comms_ready = false;
		console.log("ws error!", err_evt);
	};

	comms_closed = false;
}

function comms_ws_send(str) {
	if (comms_closed) {
		return false;
	}
	if (comms_ready) {
		ws.send(str);
	} else {
		comms.queue.push(str);
	}
	return true;
}

function comms_move(x, y) {
	// player x and player y, floats
	return comms_ws_send(JSON.stringify({t: MSG_PLAYER_MOVE, px: x, py: y}));
}

function comms_map_draw(x, y, f, c) {
	// map cell x, y, frame, and color 
	// frame is an array of numbers
	return comms_ws_send(JSON.stringify({t: MSG_MAP_PAINT, x: x, y: y, f: f, c: c}));
}

function comms_map_col_draw(x, y, f, c) {
	// map cell x, y, frame, and color 
	// frame is an array of numbers
	return comms_ws_send(JSON.stringify({t: MSG_MAP_COL_PAINT, x: x, y: y, f: f, c: c}));
}

function comms_player_draw(x, y, f, d, c) {
	// player map cell x, y, frame, direction, and color
	// frame and direction are arrays of numbers
	return comms_ws_send(JSON.stringify({t: MSG_PLAYER_PAINT, x: x, y: y, f: f, d: d, c: c}));
}

function comms_player_col_draw(x, y, f, d, c) {
	// player map cell x, y, frame, direction, and color
	// frame and direction are arrays of numbers
	return comms_ws_send(JSON.stringify({t: MSG_PLAYER_COL_PAINT, x: x, y: y, f: f, d: d, c: c}));
}
