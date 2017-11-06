// This file contains UI contol and such, and runs the game code

// some important constants
const ms_per_frame = 330;
const COLOR_NOT_SELECTED = "#000000";
const COLOR_SELECTED = "#003399";
const wkc = 87;
const upkc = 38;
const skc = 83;
const dnkc = 40
const dkc = 68;
const rikc = 39;
const akc = 65;
const lekc = 37;

// important elements
let rcontrol = document.getElementById("rightctr"); 
let canvas = document.getElementById("gamecanvas");
let curframe = document.getElementById("aniframe");
let cslide = document.getElementById('colorslider');
let cpick = document.getElementById('colorpicker');
let cgroup = document.getElementById('colorgroup');
let rpicker = document.getElementById("rinp");
let gpicker = document.getElementById("ginp");
let bpicker = document.getElementById("binp");
let brushszinp = document.getElementById("brushsz");

// important state vars
let dirty_draw = false;
let mouse_down = false;
let right_down = false;
let wdown = false;
let sdown = false;
let ddown = false;
let adown = false;

// get a game instance
console.log("Creating game");
let game = new PixGame(canvas);

function pick_color(hex, hsv, rgb) {
	cpick.style.backgroundColor = hex;
	cgroup.style.backgroundColor = hex;
	game.selected_color = PIX_ACTIVE | (rgb.r << 16) | (rgb.g << 8) | (rgb.b);
	rpicker.value = rgb.r;
	gpicker.value = rgb.g;
	bpicker.value = rgb.b;
}

let colorpicker = ColorPicker(
	cslide,
	cpick,
	pick_color
);

function get_color() {
	colorpicker.setRgb({r:rpicker.value, g:gpicker.value, b:bpicker.value});
}

let rcontrol_state = true;
function toggle_rightctr() {
	if (rcontrol_state) {
		Velocity(rcontrol, {opacity: 0, translateX:"100%"}, {duration: 500, complete: function(elements) {
			elements[0].style.display = "none";
		}});
	} else {
		Velocity(rcontrol, {opacity: 1, translateX:"0%"}, {duration: 500, begin: function(elements) {
			elements[0].style.display = "block";
		}});
	}
	rcontrol_state = !rcontrol_state;
}

function toggle_frame(framebtn) {
	console.log(framebtn);
	let selected = false;
	let frameid = parseInt(framebtn.id.substr(4), 16);
	// check if it is selected
	let i=0;
	for (; i<game.selected_frames.length; i++) {
		if (game.selected_frames[i] == frameid) {
			selected = true;
			break;
		}
	}

	if (!selected) {
		// select this one now
		game.selected_frames.push(frameid);
		framebtn.style.backgroundColor = COLOR_SELECTED;
	} else {
		// unselect this one
		game.selected_frames.splice(i, 1);
		framebtn.style.backgroundColor = COLOR_NOT_SELECTED;
	}
}

let do_animation = true;
function toggle_animation(btnel) {
	do_animation = !do_animation;
	if (do_animation) {
		btnel.innerText = "pause";
	} else {
		btnel.innerText = "play";
	}
}

function change_frame(val) {
	game.frame = val-1;
	dirty_draw = true;
}

function change_brushsz(val) {
	game.pensz = val;
	dirty_draw = true;
}

let frame_timer = 0;
// start draw loop
function do_update(ts) {
	//console.time("update");
	if (do_animation && frame_timer < ts) {
		frame_timer = ts + ms_per_frame; // schedule next tick
		curframe.value = game.anitick() + 1; // go forward a frame
		dirty_draw = true;
	}
	// move stuff
	let moved = false;
	if (wdown) {
		game.player.move(move_up);
		moved = true;
	} else if (sdown) {
		game.player.move(move_down);
		moved = true;
	}
	if (ddown) {
		game.player.move(move_right);
		moved = true;
	} else if (adown) {
		game.player.move(move_left);
		moved = true;
	}
	if (moved) {
		dirty_draw = true;
	}

	// draw it
	if (dirty_draw) {
		dirty_draw = false;
		game.draw();
	}
	//console.timeEnd("update");
	window.requestAnimationFrame(do_update);
}
window.requestAnimationFrame(do_update);

// listen for canvas resize
function canvas_resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	game.resetCan();
	dirty_draw = true;
};

window.addEventListener('resize', canvas_resize, false);
canvas_resize();

// register contols
// wasd/arrows - movement
// lmb - draw
// rmb - erase
canvas.addEventListener('mousemove', function(evt) {
	let rect = canvas.getBoundingClientRect();
	let canx = evt.clientX - rect.left;
	let cany = evt.clientY - rect.top;

	if (game.setMouse(game.can2px(canx, cany))) {
		if (right_down) {
			game.colorSel(true);
		} else if (mouse_down) {
			game.colorSel();
		}
		dirty_draw = true;
	}
}, false);
 
canvas.addEventListener('mousedown', function(evt) {
	if (evt.button == 0) {
		// left mouse
		mouse_down = true;
		game.colorSel();
	} else if (evt.button == 2) {
		// right mouse
		right_down = true;
		game.colorSel(true)
	} else if (evt.button == 1) {
		// middle mouse
		// do eyedropper
		let c = game.getColorSel();
		let r = (c & 0xff0000) >> 16;
		let g = (c & 0xff00) >> 8;
		let b = (c & 0xff);
		colorpicker.setRgb({r:r, g:g, b:b});
	}
	dirty_draw = true;
}, false);

canvas.addEventListener('mouseup', function(evt) {
	if (evt.button == 0) {
		mouse_down = false;
	} else if (evt.button == 2) {
		right_down = false;
	}
}, false);

canvas.addEventListener('wheel', function(evt) {
	var direction = (evt.detail<0 || evt.wheelDelta>0) ? 1 : -1;
	game.pensz += direction;
	if (game.pensz < 1) {
		game.pensz = 1;
	} else if (game.pensz > 18) {
		game.pensz = 18;
	}
	brushszinp.value = game.pensz;
	dirty_draw = true;
});

canvas.addEventListener('contextmenu', function(evt) {
	evt.preventDefault();
	return false; // disable context menu
});

document.addEventListener('keydown', function(evt) {
	console.log("dwn");
	switch (evt.keyCode) {
	case wkc:
	case upkc:
		wdown = true;
		break;
	case skc:
	case dnkc:
		sdown = true;
		break;
	case dkc:
	case rikc:
		ddown = true;
		break;
	case akc:
	case lekc:
		adown = true;
		break;
	}
}, false);

document.addEventListener('keyup', function(evt) {
	console.log("up");
	switch (evt.keyCode) {
	case wkc:
	case upkc:
		wdown = false;
		break;
	case skc:
	case dnkc:
		sdown = false;
		break;
	case dkc:
	case rikc:
		ddown = false;
		break;
	case akc:
	case lekc:
		adown = false;
		break;
	}
}, false);