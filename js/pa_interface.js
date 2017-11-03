// This file contains UI contol and such, and runs the game code

var rcontrol = document.getElementById("rightctr"); 
var rcontrol_state = true;

function toggle_rightctr() {
	if (rcontrol_state) {
		Velocity(rcontrol, {opacity: 0, translateX:"100%"}, {duration: 500});
	} else {
		Velocity(rcontrol, {opacity: 1, translateX:"0%"}, {duration: 500});
	}
	rcontrol_state = !rcontrol_state;
}

function pick_color(hex, hsv, rgb) {
}

ColorPicker(
	document.getElementById('colorslider'),
	document.getElementById('colorpicker'),
	pick_color
);

// get a game instance
let game = PixGame(document.getElementById("gamecanvas"));
// register contols
