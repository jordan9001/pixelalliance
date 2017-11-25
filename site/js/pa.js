// this file contains the game code, including drawing and networking

// default values
const mapw = 0x900;
const maph = 0x900;

const aniframes = 12;
const allframes = [0,1,2,3,4,5,6,7,8,9,10,11];

const move_up = 0;
const move_right = 1;
const move_down = 2;
const move_left = 3;
const move_amount = 0.50;

const max_player_w = 12;
const max_player_h = 12;
const max_player_w2 = Math.floor(max_player_w / 2);
const max_player_h2 = Math.floor(max_player_h / 2);

const pixsz = 15;
const COL_OFF = 3;
const COL_OFF2 = 6;

// type pixel
// 16 bit int
// flags, r, g, b
const PIX_BLANK = 0x0;
const BACK_COLOR = "#fff";
const BACK_PX = 0x0fff;
const PIX_ACTIVE = 0x4000;
const PIX_LOCKED = 0x2000;
const PIX_COLLISION = 0x1000;
const PIX_NOT_COLLISION = ~PIX_COLLISION;
const DEF_COLOR = (PIX_ACTIVE | 0xf00);
const COL_MASK = ~PIX_ACTIVE & 0xf000;
function PIX_COLOR(px) {
	let r = (px & 0xf00) >> 4;
	let g = (px & 0xf0);
	let b = (px & 0xf) << 4;
	r |= (r >> 4);
	g |= (g >> 4);
	b |= (b >> 4);
	return "rgb(" + r +","+ g +","+ b + ")";
}

// type PixMap
// used for actual map
// also used for player sprites and stencils
function PixMap(w, h) {
	this.w = w;
	this.h = h;
	
	// allocate the map
	this.map = new Uint16Array(h*w*aniframes);
}

PixMap.prototype.set = function(x, y, pixel, frames, withcol=false) {
	let xyoff = (y * this.w) + x;
	let off;
	for (let f=0; f<frames.length; f++) {
		off = (frames[f] * (this.w*this.h)) + xyoff;
		old = this.map[off];
		if (!withcol) {
			pixel |= (old & COL_MASK);
		}
		this.map[off] = pixel;
	}
}

PixMap.prototype.setCol = function(x, y, erase, frames) {
	let xyoff = (y * this.w) + x;
	let mul = (this.w * this.h);
	for (let f=0; f<frames.length; f++) {
		if (erase) {
			this.map[(frames[f] * mul) + xyoff] &= PIX_NOT_COLLISION;
		} else {
			let val = this.map[(frames[f] * mul) + xyoff];
			if (val === undefined) {
				val = BACK_PX;
			}
			val |= PIX_COLLISION;
			this.map[(frames[f] * mul) + xyoff] = val;
		}
	}
}

PixMap.prototype.getCol = function(x, y, frame) {
	// without edge protections
	let off = (frame * this.w * this.h) + (y * this.w) + x;
	return (this.map[off] & PIX_COLLISION);
}

PixMap.prototype.get = function(x, y, frame) {
	// without edge protections
	let off = (frame * this.w * this.h) + (y * this.w) + x;
	return this.map[off];
}

PixMap.prototype.draw = function(ctx, sx, sy, x, y, w, h, frame, background, draw_col) {
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
					if (!(px & PIX_ACTIVE)) {
						px = BACK_PX;
					}
					// invert color
					ctx.fillStyle = PIX_COLOR(~px);
					ctx.fillRect(csx+COL_OFF, csy+COL_OFF, pixsz-COL_OFF2, pixsz-COL_OFF2);
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

	this.known_location = false;

	this.map = new PixMap(max_player_w, max_player_h);
}

PixPlayer.prototype.draw = function(ctx, canx, cany, frame, draw_col) {
	if (!this.known_location) {
		return;
	}
	let canx_left = canx - (max_player_w2 * pixsz);
	let cany_top = cany - (max_player_h2 * pixsz);

	this.map.draw(ctx, canx_left, cany_top, 0, 0, this.map.w, this.map.h, frame, false, draw_col);
}

PixPlayer.prototype.at = function(x, y, frame, undermap) {
	// translate a world px coord to where we are
	// get in relation to our center
	let dx = x + max_player_w2 - Math.floor(this.x);
	let ndx = dx - undermap.w;
	let dy = y + max_player_h2 - Math.floor(this.y);
	let ndy = dy - undermap.h;

	if (ndx <= (0-undermap.w)) {
		ndx += (undermap.w * 2);
	}

	if (ndy <= 0-undermap.h) {
		ndy += (undermap.h * 2);
	}

	dx = (Math.abs(dx) < Math.abs(ndx)) ? dx : ndx;
	dy = (Math.abs(dy) < Math.abs(ndy)) ? dy : ndy;

	if (dx < 0 || dx >= this.map.w || dy < 0 || dy >= this.map.h) {
		return PIX_BLANK;
	}

	return this.map.get(dx, dy, frame);
}

PixPlayer.prototype.move = function(dir, undermap, frame, players) {
	let nexty = this.y;
	let nextx = this.x;

	switch (dir) {
	case move_up:
		nexty = ((this.y - move_amount) + undermap.h) % undermap.h;
		break;
	case move_right:
		nextx = (this.x + move_amount) % undermap.w;
		break;
	case move_down:
		nexty = (this.y + move_amount) % undermap.h;
		break;
	case move_left:
		nextx = ((this.x - move_amount) + undermap.w) % undermap.w;
		break;
	}

	// first check collision
	if (Math.floor(this.x) != Math.floor(nextx) || Math.floor(this.y) != Math.floor(nexty)) {
		// loop through the current player frame and cooresponding map grid, check if 2 collision pieces overlap
		let xoff;
		let yoff;
		let mapx = ((Math.floor(nextx) - max_player_w2) + undermap.w) % undermap.w;
		let mapy = ((Math.floor(nexty) - max_player_h2) + undermap.h) % undermap.h;
		for (yoff=0; yoff<max_player_h; yoff++) {
			for (xoff=0; xoff<max_player_w; xoff++) {
				if (this.map.getCol(xoff, yoff, frame)) {
					// check the undermap
					if (undermap.getCol((mapx+xoff) % undermap.w, (mapy+yoff) % undermap.h, frame)) {
						// would hit a collision, don't move
						return false;
					}
					// check other players
					for (let k in players) {
						if (players[k].at(mapx+xoff, mapy+yoff, frame, undermap) & PIX_COLLISION) {
							return false;
						}
					}
				}
			}
		}
	}
	
	this.x = nextx;
	this.y = nexty;
	return true;
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

	this.selected_x = 0;
	this.selected_y = 0;
	this.selected_color = DEF_COLOR;
	this.selected_frames = allframes;
	this.selected_player = false;
	this.selected_collision = false;

	this.pensz = 1;

	// set up connection
	comms_init(this);

	this.other_players = {};
	this.player = new PixPlayer(0.0, 0.0);
	this.player.known_location = true;
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
	this.map.draw(this.ctx, -left_off, -top_off, left_edge, top_edge, this.can_w, this.can_h, this.frame, true, (this.selected_collision && !this.selected_player));
	
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
		this.ctx.fillRect(0, 0, (this.can_w2 - max_player_w2) * pixsz, this.canvas.height);
		this.ctx.fillRect(0, (this.can_h2 + Math.ceil(max_player_h / 2)) * pixsz, this.canvas.width, (this.can_h2 - Math.ceil(max_player_h / 2)) * pixsz);
		this.ctx.fillRect((this.can_w2 + Math.ceil(max_player_w / 2)) * pixsz, 0, (this.can_w2 - Math.ceil(max_player_w / 2)) * pixsz, this.canvas.height);
	}

	// draw other players
	if (!this.selected_player) {
		let p_can;
		for (var k in this.other_players) {
			if (!this.other_players.hasOwnProperty(k)) {
				continue;
			}
			p_can = this.px2can(this.other_players[k].x, this.other_players[k].y);
			this.other_players[k].draw(this.ctx, p_can.x, p_can.y, this.frame, false);
		}
	}

	// draw main player
	this.player.draw(this.ctx, this.can_w2 * pixsz, this.can_h2 * pixsz, this.frame, (this.selected_collision && this.selected_player));

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
				
				if (this.selected_collision) {
					this.player.map.setCol(fx, fy, erase, this.selected_frames);
				} else {
					this.player.map.set(fx, fy, (erase)?PIX_BLANK:this.selected_color, this.selected_frames);
				}
				// send the message
				if (this.selected_collision) {
					comms_player_col_draw(fx, fy, this.selected_frames, (erase)?0:PIX_COLLISION);
				} else {
					comms_player_draw(fx, fy, this.selected_frames, (erase)?PIX_BLANK:this.selected_color);
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
					comms_map_col_draw(fx, fy, this.selected_frames, (erase)?0:PIX_COLLISION);
				} else {
					this.map.set(fx, fy, (erase)?PIX_BLANK:this.selected_color, this.selected_frames);
					comms_map_draw(fx, fy, this.selected_frames, (erase)?PIX_BLANK:this.selected_color);
				}
			}
		}
	}
}

PixGame.prototype.getColorSel = function() {
	let c;
	if (this.selected_player) {
		let pmap = this.player.map;
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

PixGame.prototype.move = function(direction) {
	this.player.move(direction, this.map, this.frame, this.other_players);
	// send a message
	comms_move(this.player.x, this.player.y);
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
		cord.x = ((canx - (this.canvas.width / 2)) / pixsz) + max_player_w2;
		cord.y = ((cany - (this.canvas.height / 2)) / pixsz) + max_player_h2;
	} else {
		cord.x = ((canx / pixsz) + (this.player.x - this.can_w2) + this.map.w) % this.map.w;
		cord.y = ((cany / pixsz) + (this.player.y - this.can_h2) + this.map.h) % this.map.h;
	}
	return cord;
}

PixGame.prototype.px2can = function(pxx, pxy) {
	let can_cord = {};
	if (this.selected_player) {
		can_cord.x = ((pxx - max_player_w2) * pixsz) + (this.canvas.width / 2);
		can_cord.y = ((pxy - max_player_h2) * pixsz) + (this.canvas.height / 2);
	} else {
		// px dist from player to select
		let dpx = pxx - this.player.x;
		let ndpx = pxx - (this.player.x + this.map.w);
		//let ndpx = dpx + this.map.w;

		let dpy = pxy - this.player.y;
		let ndpy = pxy - (this.player.y + this.map.h);
		//let ndpy = dpy + this.map.h;
		
		if (ndpx <= (0-this.map.w)) {
			ndpx += (this.map.w * 2);
		}

		if (ndpy <= 0-this.map.h) {
			ndpy += (this.map.h * 2);
		}

		dpx = (Math.abs(dpx) < Math.abs(ndpx)) ? dpx : ndpx;
		dpy = (Math.abs(dpy) < Math.abs(ndpy)) ? dpy : ndpy;

		// canvas x = middle + (dpx * pixsz);
		can_cord.x = (dpx + this.can_w2) * pixsz;
		can_cord.y = (dpy + this.can_h2) * pixsz;
	}
	return can_cord;
}

PixGame.prototype.other_player_set = function(id, x, y, color, frames, fullwrite) {
	// first check if the other player exists, if not create him
	if (this.other_players[id] === undefined) {
		this.other_players[id] = new PixPlayer(0.0, 0.0);
	}

	this.other_players[id].map.set(x, y, color, frames, fullwrite)
}

PixGame.prototype.other_player_setCol = function(id, x, y, erase, frames) {
	// first check if the other player exists, if not create him
	if (this.other_players[id] === undefined) {
		this.other_players[id] = new PixPlayer(0.0, 0.0);
	}

	this.other_players[id].map.setCol(x, y, erase, frames)
}

PixGame.prototype.other_player_move = function(id, px, py) {
	// first check if the other player exists, if not create him
	if (this.other_players[id] === undefined) {
		this.other_players[id] = new PixPlayer(0.0, 0.0);
	}

	this.other_players[id].x = px;
	this.other_players[id].y = py;

	this.other_players[id].known_location = true;
}
