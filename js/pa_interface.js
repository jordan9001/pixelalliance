// This file contains UI contol and such, and runs the game code

// global vars for interface
let rcontrol = document.getElementById("rightctr"); 
let rcontrol_state = true;
let cslide = document.getElementById('colorslider');
let cpick = document.getElementById('colorpicker');
let canvas = document.getElementById("gamecanvas");

function toggle_rightctr() {
	if (rcontrol_state) {
		Velocity(rcontrol, {opacity: 0, translateX:"100%"}, {duration: 500});
	} else {
		Velocity(rcontrol, {opacity: 1, translateX:"0%"}, {duration: 500});
	}
	rcontrol_state = !rcontrol_state;
}

// get a game instance
console.log("Creating game");
let game = new PixGame(canvas);

// start draw loop
function do_update(ts) {
	console.time("draw");
	game.draw();
	console.timeEnd("draw");
}

// listen for canvas resize
function canvas_resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	game.resetCan();
	window.requestAnimationFrame(do_update);
};
window.addEventListener('resize', canvas_resize, false);
canvas_resize();

// test controls
window.requestAnimationFrame(do_update);
console.log("Done");

// register contols
let mouse_down = false;
canvas.addEventListener('mousemove', function(evt) {
	let rect = canvas.getBoundingClientRect();
	let canx = evt.clientX - rect.left;
	let cany = evt.clientY - rect.top;

	if (game.setMouse(game.can2px(canx, cany))) {
		if (mouse_down) {
			game.colorSel();
		}
		window.requestAnimationFrame(do_update);
	}
}, false);

canvas.addEventListener('mousedown', function(evt) {
	mouse_down = true;
	game.colorSel();
}, false);

canvas.addEventListener('mouseup', function(evt) {
	mouse_down = false;
}, false);


let wdown = false;
const wkc = 87;
let sdown = false;
const skc = 83;
let ddown = false;
const dkc = 68;
let adown = false;
const akc = 65;

canvas.addEventListener('keydown', function(evt) {
	switch (evt.keyCode) {
	case wkc:
		wdown = true;
		break;
	case skc:
		sdown = true;
		break;
	case dkc:
		ddown = true;
		break;
	case akc:
		adown = true;
		break;
	}
}, false);

canvas.addEventListener('keyup', function(evt) {
	switch (evt.keyCode) {
	case wkc:
		wdown = false;
		break;
	case skc:
		sdown = false;
		break;
	case dkc:
		ddown = false;
		break;
	case akc:
		adown = false;
		break;
	}
}, false);

function pick_color(hex, hsv, rgb) {
	cslide.style.backgroundColor = hex;
	cpick.style.backgroundColor = hex;
	game.selected_color = PIX_ACTIVE | (rgb.r << 16) | (rgb.g << 8) | (rgb.b);
}

ColorPicker(
	cslide,
	cpick,
	pick_color
);
