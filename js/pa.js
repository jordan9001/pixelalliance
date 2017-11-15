// this file contains the game code, including drawing and networking

// default values
const mapw = 0x1234;
const maph = 0x1234;

const aniframes = 12;
const allframes = [0,1,2,3,4,5,6,7,8,9,10,11];

const move_up = 0;
const move_right = 1;
const move_down = 2;
const move_left = 3;
const move_amount = 0.50;

const max_player_w = 12;
const max_player_h = 12;

const pmap_up = 0;
const pmap_right = 1;
const pmap_down = 2;
const pmap_left = 3;
const pmap_mov_up = 4;
const pmap_mov_right = 5;
const pmap_mov_down = 6;
const pmap_mov_left = 7;
const allpmaps = [0,1,2,3,4,5,6,7];

const pixsz = 15;
const COL_OFF = 3;
const COL_OFF2 = 6;

// type pixel
// 32 bit int
// flags, r, g, b
const PIX_BLANK = 0x0;
const BACK_COLOR = "rgb(255, 255, 255)";
const PIX_ACTIVE = 0x08000000;
const PIX_LOCKED = 0x04000000;
const PIX_TOP = 0x02000000;
const PIX_COLLISION = 0x01000000;
const PIX_NOT_COLLISION = ~PIX_COLLISION;
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

PixMap.prototype.setCol = function(x, y, erase, frames) {
	xyoff = (y * this.w) + x;
	for (let f=0; f<frames.length; f++) {
		if (erase) {
			this.map[(frames[f] * (this.w*this.h)) + xyoff] &= PIX_NOT_COLLISION;
		} else {
			this.map[(frames[f] * (this.w*this.h)) + xyoff] |= PIX_COLLISION;
		}
	}
}

PixMap.prototype.get = function(x, y, frame) {
	off = (frame * this.w * this.h) + (y * this.w) + x;
	return this.map[off];
}

PixMap.prototype.draw = function(ctx, sx, sy, x, y, w, h, frame, background, draw_col) {
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
				if (background) {
					ctx.fillStyle = BACK_COLOR;
					ctx.fillRect(csx-0.6, csy-0.6, pixsz+0.6, pixsz+0.6); // the 0.6 helps reduce ghosting
				}
			} else {
				ctx.fillStyle = PIX_COLOR(px);
				ctx.fillRect(csx-0.6, csy-0.6, pixsz+0.6, pixsz+0.6); // the 0.6 helps reduce ghosting
			}

			// draw collision
			if (draw_col) {
				if (px & PIX_COLLISION) {
					ctx.strokeStyle = "#000000";
					ctx.fillStyle = "#ffffff";
					ctx.lineWidth = 2;
					ctx.fillRect(csx+COL_OFF, csy+COL_OFF, pixsz-COL_OFF2, pixsz-COL_OFF2);
					ctx.strokeRect(csx+COL_OFF, csy+COL_OFF, pixsz-COL_OFF2, pixsz-COL_OFF2);
				}
			}
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

	this.last_dir = move_down; // direction to draw
	this.moving = false; // state to draw

	this.up_map = new PixMap(max_player_w, max_player_h);
	this.right_map = new PixMap(max_player_w, max_player_h);
	this.down_map = new PixMap(max_player_w, max_player_h);
	this.left_map = new PixMap(max_player_w, max_player_h);

	this.mov_up_map = new PixMap(max_player_w, max_player_h);
	this.mov_right_map = new PixMap(max_player_w, max_player_h);
	this.mov_down_map = new PixMap(max_player_w, max_player_h);
	this.mov_left_map = new PixMap(max_player_w, max_player_h);

	this.pmaps = [this.up_map, this.right_map, this.down_map, this.left_map, this.mov_up_map, this.mov_right_map, this.mov_down_map, this.mov_left_map];
}

PixPlayer.prototype.draw = function(ctx, canx, cany, frame, draw_col) {
	let map = this.curMap();

	let canx_left = canx - (Math.floor(max_player_w / 2) * pixsz);
	let cany_top = cany - (Math.floor(max_player_h / 2) * pixsz);

	map.draw(ctx, canx_left, cany_top, 0, 0, map.w, map.h, frame, false, draw_col);
}

PixPlayer.prototype.move = function(dir) {
	let nexty = this.y;
	let nextx = this.x;

	switch (dir) {
	case move_up:
		nexty = this.y - move_amount;
		break;
	case move_right:
		nextx = this.x + move_amount;
		break;
	case move_down:
		nexty = this.y + move_amount;
		break;
	case move_left:
		nextx = this.x - move_amount;
		break;
	}
	this.last_dir = dir;


	// first check collision
	if (Math.floor(this.x) != Math.floor(nextx) || Math.floor(this.y) != Math.floor(nexty)) {
		// loop through the current player frame and cooresponding map grid, check if 2 collision pieces overlap
		//TODO
	}
	
	this.x = nextx;
	this.y = nexty;
}

PixPlayer.prototype.curMap = function() {
	let map;

	switch (this.last_dir) {
	case move_up:
		if (this.moving) {
			map = this.mov_up_map;
		} else {
			map = this.up_map;
		}
		break;
	case move_right:
		if (this.moving) {
			map = this.mov_right_map;
		} else {
			map = this.right_map;
		}
		break;
	case move_down:
		if (this.moving) {
			map = this.mov_down_map;
		} else {
			map = this.down_map;
		}
		break;
	case move_left:
		if (this.moving) {
			map = this.mov_left_map;
		} else {
			map = this.left_map;
		}
		break;
	}
	return map;
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
	this.selected_player = false;
	this.selected_playermaps = allpmaps;
	this.selected_collision = false;

	this.pensz = 1;
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
	this.map.draw(this.ctx, -left_off, -top_off, left_edge, top_edge, this.can_w, this.can_h, this.frame, true, (game.selected_collision && !game.selected_player));
	
	// draw selected pixel cursor
	if (PIX_ACTIVE & this.selected_color) {
		this.ctx.fillStyle = PIX_COLOR(this.selected_color);
		let penoff = Math.floor(this.pensz/2);
		let can_cord = this.px2can(this.selected_x - penoff, this.selected_y - penoff);
		this.ctx.fillRect(can_cord.x, can_cord.y, pixsz * this.pensz, pixsz * this.pensz);
	}
	

	// if we are drawing the player for editing, draw the surrounding area a see through black
	if (this.selected_player) {
		this.ctx.fillStyle = "rgba(0,0,0,0.4)";
		this.ctx.fillRect(0, 0, this.canvas.width, (this.can_h2 - Math.floor(max_player_h / 2)) * pixsz);
		this.ctx.fillRect(0, 0, (this.can_w2 - Math.floor(max_player_w / 2)) * pixsz, this.canvas.height);
		this.ctx.fillRect(0, (this.can_h2 + Math.ceil(max_player_h / 2)) * pixsz, this.canvas.width, (this.can_h2 - Math.ceil(max_player_h / 2)) * pixsz);
		this.ctx.fillRect((this.can_w2 + Math.ceil(max_player_w / 2)) * pixsz, 0, (this.can_w2 - Math.ceil(max_player_w / 2)) * pixsz, this.canvas.height);
	}

	// draw main player
	this.player.draw(this.ctx, this.can_w2 * pixsz, this.can_h2 * pixsz, this.frame, false, (game.selected_collision && game.selected_player));

	// draw other players
	// get the canvas coordinates for the player coordinates
	let can_px;
	let can_py;
	// draw map top pixels
}

PixGame.prototype.anitick = function() {
	this.frame = (this.frame + 1) % aniframes;
	return this.frame;
}

PixGame.prototype.colorSel = function(erase=false) {
	// change map pixel
	// based on brush size;
	let dy;
	let dx;
	let fy;
	let fx;
	let penoff = Math.floor(this.pensz/2);
	if (this.selected_player) {
		let pmaps = this.player.pmaps;
		let i;
		for (dy=0; dy<this.pensz; dy++) {
			for (dx=0; dx<this.pensz; dx++) {
				fx = this.selected_x + dx - penoff;
				if (fx < 0 || fx >= max_player_w) {
					continue;
				}
				fy = this.selected_y + dy - penoff;
				if (fy < 0 || fy >= max_player_h) {
					continue;
				}
				for (i=0; i<this.selected_playermaps.length; i++) {
					if (this.selected_collision) {
						pmaps[this.selected_playermaps[i]].setCol(fx, fy, erase, this.selected_frames);
					} else {
						pmaps[this.selected_playermaps[i]].set(fx, fy, (erase)?PIX_BLANK:this.selected_color, this.selected_frames);
					}
				}
			}
		}
	} else {
		for (dy=0; dy<this.pensz; dy++) {
			for (dx=0; dx<this.pensz; dx++) {
				fx = this.selected_x + dx - penoff;
				fy = this.selected_y + dy - penoff;
				fx = (fx + this.map.w) % this.map.w;
				fy = (fy + this.map.h) % this.map.h;

				if (this.selected_collision) {
					this.map.setCol(fx, fy, erase, this.selected_frames);
				} else {
					this.map.set(fx, fy, (erase)?PIX_BLANK:this.selected_color, this.selected_frames);
				}
			}
		}
	}
}

PixGame.prototype.getColorSel = function() {
	let c;
	if (this.selected_player) {
		let pmap = this.player.curMap();
		if (this.selected_x < 0 || this.selected_y < 0 || this.selected_x >= pmap.w || this.selected_y >= pmap.h) {
			return BACK_COLOR;
		}
		c = pmap.get(this.selected_x, this.selected_y, game.frame);
	} else {
		c = this.map.get(this.selected_x, this.selected_y, game.frame);
		if (!(c & PIX_ACTIVE)) {
			c = BACK_COLOR;
		}
	}
	return c;
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
	if (this.selected_player) {
		cord.x = ((canx - (this.canvas.width / 2)) / pixsz) + Math.floor(max_player_w / 2);
		cord.y = ((cany - (this.canvas.height / 2)) / pixsz) + Math.floor(max_player_h / 2);
	} else {
		cord.x = ((canx / pixsz) + (this.player.x - this.can_w2) + this.map.w) % this.map.w;
		cord.y = ((cany / pixsz) + (this.player.y - this.can_h2) + this.map.h) % this.map.h;
	}
	return cord;
}

PixGame.prototype.px2can = function(pxx, pxy) {
	let can_cord = {};
	if (this.selected_player) {
		can_cord.x = ((pxx - Math.floor(max_player_w / 2)) * pixsz) + (this.canvas.width / 2);
		can_cord.y = ((pxy - Math.floor(max_player_h / 2)) * pixsz) + (this.canvas.height / 2);
	} else {
		// px dist from player to select
		dpx = pxx - this.player.x;
		ndpx = pxx - (this.player.x + this.map.w);

		dpy = pxy - this.player.y;
		ndpy = pxy - (this.player.y + this.map.h);

		dpx = (Math.abs(dpx) < Math.abs(ndpx)) ? dpx : ndpx;
		dpy = (Math.abs(dpy) < Math.abs(ndpy)) ? dpy : ndpy;

		// canvas x = middle + (dpx * pixsz);
		can_cord.x = (dpx + this.can_w2) * pixsz;
		can_cord.y = (dpy + this.can_h2) * pixsz;
	}
	return can_cord;
}
