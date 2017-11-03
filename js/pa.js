// this file contains the game code, including drawing and networking

// default values
const mapw = 0x1234;
const maph = 0x1234;

const aniframes = 12;

const pixsz = 9;

// type pixel
// 32 bit int
// flags, r, g, b
const PIX_BLANK = 0x0;
const PIX_ACTIVE = 0x08000000;
const PIX_LOCKED = 0x04000000;
const PIX_TOP = 0x02000000;
const PIX_COLLISION = 0x01000000;
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
	this.map = [];
	for (let f=0; f<aniframes; f++) {
		for (let i=0; i<h; i++) {
			this.map[i] = [];
			for (let j=0; j<w; j++) {
				this.map[i][j] = 0x0;
			}
		}
	}
}

PixMap.prototype.draw = function(ctx, sx, sy, x, y, w, h, frame) {
	let cy = y;
	let csy = sy;
	while (cy < y+h) {
		let cx = x;
		let csx = sx;
		while (cx < x+w) {
			px = this.map[frame][cy][cx];
			if (!(px & PIX_ACTIVE)) {
				continue;
			}
			ctx.fillstyle = PIX_COLOR(px);
			ctx.fillRect(csx, csy, pixsz, pixsz);
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
}

PixPlayer.prototype.draw = function() {

}

// type PixGame
function PixGame(canvas) {
	this.map = new PixMap(mapw, maph)
	this.canvas = canvas;
	this.ctx = canvas.getContext("2d");
	
	this.frame = 0; // counter for animation frames

	this.player = new PixPlayer(0.0, 0.0);
	this.other_players = [];
}

PixGame.prototype.draw = function() {
	// draw the map
	// get canvas size in blocks
	let can_w = this.canvas.width / pixsz;
	let can_h = this.canvas.height / pixsz;
	// get the coord
	let left_edge = this.player.x - (can_w/2);
	let top_edge = this.player.y - (can_h/2);
	// account for negatives, then round down
	left_edge = Math.floor((left_edge + this.map.w) % this.map.w);
	top_edge = Math.floor((top_edge + this.map.h) % this.map.h);
	// draw the map
	this.map.draw(this.ctx, 0, 0, left_edge, top_edge, can_w, can_h, this.frame);

	// draw players
	// draw map top pixels
}

PixGame.prototype.color = function(x, y, pixel, frames) {
	// change map pixel
	for (let f=0; f<frames.length; f++) {
		this.map.map[frames[f]][y][x] = pixel;
	}
}
