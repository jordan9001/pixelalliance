// this file contains the game code, including drawing and networking

// default values
const mapw = 0x1234;
const maph = 0x1234;

const aniframes = 12;
const allframes = [0,1,2,3,4,5,6,7,8,9,10,11];

const pixsz = 15;

// type pixel
// 32 bit int
// flags, r, g, b
const PIX_BLANK = 0x0;
const BACK_COLOR = "rgb(255, 255, 255)";
const PIX_ACTIVE = 0x08000000;
const PIX_LOCKED = 0x04000000;
const PIX_TOP = 0x02000000;
const PIX_COLLISION = 0x01000000;
const DEF_COLOR = (PIX_ACTIVE | 0xff0000);
function PIX_COLOR(px) {
	let r = (px & 0xff0000) >> 0x10;
	let g = (px & 0xff00) >> 0x08;
	let b = (px & 0xff);
	return "rgb(" + r +","+ g +","+ b + ")";
}

// type PixMap
// used for actual map
// also used for player sprites and stencils
function PixMap(w, h) {
	this.w = w;
	this.h = h;
	
	// allocate the map
	this.map = new Array(h*w*aniframes);
}

PixMap.prototype.set = function(x, y, pixel, frames) {
	xyoff = (y * this.w) + x;
	for (let f=0; f<frames.length; f++) {
		this.map[(frames[f] * (this.w*this.h)) + xyoff] = pixel;
	}
}

PixMap.prototype.get = function(x, y, frame) {
	off = (frame * this.w * this.h) + (y * this.w) + x;
	return this.map[off];
}

PixMap.prototype.draw = function(ctx, sx, sy, x, y, w, h, frame) {
	//console.log("drawing map "+ x +","+ y +" "+ w +","+ h);
	//console.log("From "+ sx +","+ sy);
	let cy = y;
	let csy = sy;
	let cx = 0;
	let csx = 0;
	while (cy < y+h) {
		cx = x;
		csx = sx;
		while (cx < x+w) {
			px = this.map[(frame * this.w * this.h) + ((cy % this.h) * this.w) + (cx % this.w)];
			if ((px === undefined) || !(px & PIX_ACTIVE)) {
				ctx.fillStyle = BACK_COLOR;
			} else {
				// debug
				//console.log(PIX_COLOR(px));
				ctx.fillStyle = PIX_COLOR(px);
			}
			//console.log(ctx.fillStyle);
			ctx.fillRect(csx-0.5, csy-0.5, pixsz+0.9, pixsz+0.9);
			csx += pixsz;
			cx++;
		}
		csy += pixsz;
		cy++;
	} 
}

// type PixPlayer
function PixPlayer(x, y) {
	this.x = x; // floating point position values
	this.y = y;

	this.last_dir; // direction to draw

	this.up_map;
	this.right_map;
	this.down_map;
	this.left_map;

	this.mov_up_map;
	this.mov_right_map;
	this.mov_down_map;
	this.mov_left_map;
}

PixPlayer.prototype.draw = function() {

}

// type PixGame
function PixGame(canvas) {
	this.map = new PixMap(mapw, maph)
	this.canvas = canvas;
	this.ctx = canvas.getContext("2d");
	this.can_w = this.canvas.width / pixsz;
	this.can_h = this.canvas.height / pixsz;
	this.can_w2 = this.can_w / 2;
	this.can_h2 = this.can_h / 2;
	
	this.frame = 0; // counter for animation frames

	this.player = new PixPlayer(0.0, 0.0);
	this.other_players = [];

	this.selected_x = 0;
	this.selected_y = 0;
	this.selected_color = DEF_COLOR;
	this.selected_frames = allframes;
}

PixGame.prototype.draw = function() {
	// draw the map
	// get canvas size in blocks
	// get the coord
	let left_edge = this.player.x - (this.can_w2);
	let top_edge = this.player.y - (this.can_h2);
	// account for negatives, then round down
	left_edge = ((left_edge + this.map.w) % this.map.w);
	top_edge = ((top_edge + this.map.h) % this.map.h);

	// get our edge offset pieces
	let left_off = (left_edge % 1) * pixsz;
	let top_off = (top_edge % 1) * pixsz;
	
	// floor it for indicies 
	left_edge = Math.floor(left_edge);
	top_edge = Math.floor(top_edge);
	
	// draw the map
	this.map.draw(this.ctx, -left_off, -top_off, left_edge, top_edge, this.can_w, this.can_h, this.frame);
	
	// draw selected pixel cursor
	if (PIX_ACTIVE & this.selected_color) {
		this.ctx.fillStyle = PIX_COLOR(this.selected_color);
		let can_cord = this.px2can(this.selected_x, this.selected_y);
		this.ctx.fillRect(can_cord.x, can_cord.y, pixsz, pixsz);
	}
	
	// draw players
	// draw map top pixels
}

PixGame.prototype.anitick = function() {
	this.frame = (this.frame + 1) % aniframes;
	return this.frame;
}

PixGame.prototype.color = function(x, y, pixel, frames) {
	// change map pixel
	this.map.set(x, y, pixel, frames);
}

PixGame.prototype.colorSel = function(erase=false) {
	// change map pixel
	this.map.set(this.selected_x, this.selected_y, (erase)?PIX_BLANK:this.selected_color, this.selected_frames);
}

PixGame.prototype.getColorSel = function() {
	let fr = 0;
	if (this.selected_frames.length > 0) {
		fr = this.selected_frames[0];
	}
	return this.map.get(this.selected_x, this.selected_y, fr);
}

PixGame.prototype.resetCan = function() {
	this.can_w = this.canvas.width / pixsz;
	this.can_h = this.canvas.height / pixsz;
	this.can_w2 = this.can_w / 2;
	this.can_h2 = this.can_h / 2;
}

PixGame.prototype.setMouse = function(cord) {
	let dirty = false;
	if (this.selected_x != Math.floor(cord.y) || this.selected_y != Math.floor(cord.y)) {
		dirty = true;
	}

	this.selected_x = Math.floor(cord.x);
	this.selected_y = Math.floor(cord.y);
	
	return dirty;
}

PixGame.prototype.can2px = function(canx, cany) {
	let cord = {};
	cord.x = ((canx / pixsz) + (this.player.x - this.can_w2) + this.map.w) % this.map.w;
	cord.y = ((cany / pixsz) + (this.player.y - this.can_h2) + this.map.h) % this.map.h;
	return cord;
}

PixGame.prototype.px2can = function(pxx, pxy) {
	let can_cord = {};
	// px dist from player to select
	dpx = pxx - this.player.x;
	ndpx = pxx - (this.player.x + this.map.w);

	dpy = pxy - this.player.y;
	ndpy = pxy - (this.player.x + this.map.h);

	dpx = (Math.abs(dpx) < Math.abs(ndpx)) ? dpx : ndpx;
	dpy = (Math.abs(dpy) < Math.abs(ndpy)) ? dpy : ndpy;

	// canvas x = middle + (dpx * pixsz);
	can_cord.x = (dpx + this.can_w2) * pixsz;
	can_cord.y = (dpy + this.can_h2) * pixsz;
	
	return can_cord;
}
