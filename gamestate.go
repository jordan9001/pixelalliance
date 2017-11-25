package main

import (
	"encoding/binary"
	"errors"
	"log"
	"os"
	"sync"
)

// types
type mapint uint16
type fchange struct {
	I int
	C mapint
}

// constants
const MAPW int = 0x900
const MAPH int = 0x900
const FRAMES int = 12
const FRAME_SZ int = MAPW * MAPH
const BLOCK_SIZE int = 300
const PIX_ACTIVE mapint = 0x4000
const PIX_LOCKED mapint = 0x2000
const PIX_COLLISION mapint = 0x1000
const PIX_NOT_COLLISION = 0xffff ^ PIX_COLLISION
const PLAYER_W int = 12
const PLAYER_H int = 12
const PFRAME_SZ int = PLAYER_W * PLAYER_H
const PMAP_DIRS int = 8
const PMAP_SIZE int = PLAYER_W * PLAYER_H * FRAMES
const FILEBUFAMOUNT int = 32
const SIZEOFMAPINT int = 2

// global state variables
var mainmap []mapint
var pmap map[int][]mapint // player stuff by Id
var pmap_mux = &sync.Mutex{}
var filech chan fchange

// functions
func state_init(filepath string) bool {
	mainmap = make([]mapint, MAPW*MAPH*FRAMES)
	pmap_mux.Lock()
	pmap = make(map[int][]mapint)
	pmap_mux.Unlock()

	// check if there is an existing file
	var f *os.File
	var err error

	f, err = os.OpenFile(filepath, os.O_RDWR, 0644)
	if err != nil {
		f, err = setup_file(filepath)
		if err != nil {
			log.Fatalf("Could not create file for use! err: %v\n", err)
		}
		log.Printf("Created state file %q\n", filepath)
	} else {
		log.Printf("Found state file %q\n", filepath)
		err = load_state(f)
		if err != nil {
			log.Fatalf("Could not load state from file! err: %v\n", err)
		}
	}

	filech = make(chan fchange, FILEBUFAMOUNT)
	go file_persist(f)

	return true
}

func setup_file(filepath string) (*os.File, error) {
	f, err := os.OpenFile(filepath, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return nil, err
	}

	err = f.Truncate(int64(MAPW * MAPH * FRAMES * SIZEOFMAPINT))
	if err != nil {
		return nil, err
	}

	//truncate makes all zeros, at least on linux, so that is nice
	// we are all ready

	return f, nil
}

func load_state(f *os.File) error {
	fi, err := f.Stat()
	if err != nil {
		return err
	}

	if fi.Size() != int64(MAPW*MAPH*FRAMES*SIZEOFMAPINT) {
		return errors.New("unexpeceted File Size\n")
	}

	// we could do the unsafe c way here, but we will see if we can just get away with this for now

	var buf []byte = make([]byte, MAPW*MAPH*FRAMES*SIZEOFMAPINT)
	_, err = f.ReadAt(buf, 0)
	if err != nil {
		return err
	}
	for i := 0; i < (len(buf) / SIZEOFMAPINT); i++ {
		mainmap[i] = mapint(binary.LittleEndian.Uint16(buf[i*SIZEOFMAPINT:]))
	}
	return nil
}

func file_persist(f *os.File) {
	var ok bool
	var change fchange
	var buf []byte
	buf = make([]byte, SIZEOFMAPINT)
	for {
		change, ok = <-filech
		if !ok {
			return
		}
		binary.LittleEndian.PutUint16(buf, uint16(change.C))
		_, err := f.WriteAt(buf, int64(change.I*SIZEOFMAPINT))
		if err != nil {
			return
		}
	}
}

func pitox(i int) int {
	return (i % PFRAME_SZ) % PLAYER_W
}

func pitoy(i int) int {
	return (i % PFRAME_SZ) / PLAYER_W
}

func pitof(i int) []int {
	frames := make([]int, 1)
	frames[0] = i / PFRAME_SZ
	return frames
}

func pxyftoi(x, y, f int) int {
	return (f * PFRAME_SZ) + (y * PLAYER_W) + x
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
	// create a pmap for this player
	pmap_mux.Lock()
	pmap[c.Id] = make([]mapint, PMAP_SIZE)
	pmap_mux.Unlock()
	// Send map state
	// TODO really, we should just send stuff in the block and adjacent blocks
	var color mapint
	for i := 0; i < len(mainmap); i++ {
		color = mainmap[i]
		if ((color & PIX_ACTIVE) != 0) || ((color & PIX_COLLISION) != 0) {
			c.Out <- msgctrl{
				Id: -1, // by server
				T:  MSG_MAP_PAINT,
				X:  itox(i),
				Y:  itoy(i),
				F:  itof(i),
				C:  int(color),
				S:  true, // server says write all of it, not just col or paint
			}
		}
	}
	// Send player locations
	clients_mux.Lock()
	for _, oc := range clients {
		if oc.Id == c.Id {
			continue
		}
		c.Out <- msgctrl{
			Id: oc.Id,
			T:  MSG_PLAYER_MOVE,
			Px: oc.Px,
			Py: oc.Py,
		}
	}
	clients_mux.Unlock()
	// Send player maps states
	pmap_mux.Lock()
	for id, pm := range pmap {
		for i := 0; i < len(pm); i++ {
			color = pm[i]
			if ((color & PIX_ACTIVE) != 0) || ((color & PIX_COLLISION) != 0) {
				c.Out <- msgctrl{
					Id: id,
					T:  MSG_PLAYER_PAINT,
					X:  pitox(i),
					Y:  pitoy(i),
					F:  pitof(i),
					C:  int(color),
					S:  true,
				}
			}
		}
	}
	pmap_mux.Unlock()
}

func clear_state(id int) {
	pmap_mux.Lock()
	delete(pmap, id)
	pmap_mux.Unlock()
}

func update_map(x, y int, color int, frames []int) {
	var i int
	var c mapint = mapint(color)
	for _, f := range frames {
		i = xyftoi(x, y, f)
		mainmap[i] = c
		filech <- fchange{I: i, C: c}
	}
}

func update_col_map(x, y int, color int, frames []int) {
	var i int
	var c mapint
	for _, f := range frames {
		i = xyftoi(x, y, f)
		if color != 0 {
			c = mainmap[i] | PIX_COLLISION
		} else {
			c = mainmap[i] & PIX_NOT_COLLISION
		}
		mainmap[i] = c
		filech <- fchange{I: i, C: c}
	}
}

func update_player(id, x, y int, color int, frames []int) {
	pmap_mux.Lock()
	for _, f := range frames {
		pmap[id][pxyftoi(x, y, f)] = mapint(color)
	}
	pmap_mux.Unlock()
}

func update_col_player(id, x, y int, color int, frames []int) {
	pmap_mux.Lock()
	for _, f := range frames {
		if color != 0 {
			pmap[id][pxyftoi(x, y, f)] |= PIX_COLLISION
		} else {
			pmap[id][pxyftoi(x, y, f)] &= PIX_NOT_COLLISION
		}
	}
	pmap_mux.Unlock()
}
