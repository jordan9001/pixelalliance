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

var alert_box = document.getElementById("alertbox");

function comms_init(game) {
	ws = new WebSocket("ws://"+ location.host + "/ws");

	var game_obj = game;
	ws.onmessage = function(msg_evt) {
		msg_obj = JSON.parse(msg_evt.data);
		switch (msg_obj.t) {
		case MSG_MAP_PAINT:
			game_obj.map.set(msg_obj.x, msg_obj.y, msg_obj.c, msg_obj.f, msg_obj.s);
			break;
		case MSG_PLAYER_PAINT:
			game_obj.other_player_set(msg_obj.id, msg_obj.x, msg_obj.y, msg_obj.c, msg_obj.f, msg_obj.s);
			break;
		case MSG_PLAYER_MOVE:
			game_obj.other_player_move(msg_obj.id, msg_obj.px, msg_obj.py);
			break;
		case MSG_MAP_COL_PAINT:
			game_obj.map.setCol(msg_obj.x, msg_obj.y, (msg_obj.c == 0), msg_obj.f); 
			break;
		case MSG_PLAYER_COL_PAINT:
			game_obj.other_player_setCol(msg_obj.id, msg_obj.x, msg_obj.y, (msg_obj.c == 0), msg_obj.f);
			break;
		case MSG_PLAYER_REMOVE:
			game_obj.other_players[msg_obj.id] = undefined;
			break;
		}
		dirty_draw = true;
	};

	ws.onopen = function(opn_evt) {
		comms_ready = true;
		while (comms_queue.length > 0) {
			msg = comms_queue.shift();
			ws.send(msg);
		}
	};

	ws.onerror = function(err_evt) {
		comms_closed = true;
		comms_ready = false;
		console.log("ws error!", err_evt);
		alert_box.style.display = "block";
		alert_box.innerText = "Connection Lost";
	};

	ws.onclose = function(close_evt) {
		comms_closed = true;
		comms_ready = false;
		console.log("ws close!", close_evt);
		alert_box.style.display = "block";
		alert_box.innerText = "Connection Lost";
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
		comms_queue.push(str);
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

function comms_player_draw(x, y, f, c) {
	// player map cell x, y, frame, direction, and color
	// frame and direction are arrays of numbers
	msg = {t: MSG_PLAYER_PAINT, x: x, y: y, f: f, c: c};
	return comms_ws_send(JSON.stringify(msg));
}

function comms_player_col_draw(x, y, f, c) {
	// player map cell x, y, frame, direction, and color
	// frame and direction are arrays of numbers
	return comms_ws_send(JSON.stringify({t: MSG_PLAYER_COL_PAINT, x: x, y: y, f: f, c: c}));
}
