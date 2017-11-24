package main

import ()

// constants
const MAPW int = 0x1234
const MAPH int = 0x1234
const FRAMES int = 12
const FRAME_SZ int = MAPW * MAPH
const BLOCK_SIZE int = 300
const PIX_ACTIVE int = 0x08000000
const PIX_COLLISION int = 0x01000000
const PIX_NOT_COLLISION int = 0xffffffff ^ PIX_COLLISION

// global state variables
var mainmap []int

// functions
func state_init() bool {
	mainmap = make([]int, MAPW*MAPH*FRAMES)
	return true
}

func itox(i int) int {
	return (i % FRAME_SZ) % MAPW
}

func itoy(i int) int {
	return (i % FRAME_SZ) / MAPW
}

func itof(i int) []int {
	frames := make([]int, 1)
	frames[0] = i / FRAME_SZ
	return frames
}

func xyftoi(x, y, f int) int {
	return (f * FRAME_SZ) + (y * MAPW) + x
}

func send_updates(c client) {
	// TODO really, we should just send stuff in the block and adjacent blocks
	var color int
	for i := 0; i < len(mainmap); i++ {
		color = mainmap[i]
		if (color & PIX_ACTIVE) != 0 {
			c.Out <- msgctrl{
				Id: -1,
				X:  itox(i),
				Y:  itoy(i),
				F:  itof(i),
				C:  color,
			}
		}
	}
}

func update_map(x, y int, color int, frames []int) {
	for _, f := range frames {
		mainmap[xyftoi(x, y, f)] = color
	}
}

func update_col_map(x, y int, color int, frames []int) {
	for _, f := range frames {
		if color != 0 {
			mainmap[xyftoi(x, y, f)] |= PIX_COLLISION
		} else {
			mainmap[xyftoi(x, y, f)] &= PIX_NOT_COLLISION
		}
	}
}

func getBlock(px, py float64) int {
	//TODO
	return 0
}
