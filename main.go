package main

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

// types
type msgctrl struct {
	Id int     `json:"id"`
	T  int     `json:"t"`
	Px float64 `json:"px"`
	Py float64 `json:"py"`
	X  int     `json:"x"`
	Y  int     `json:"y"`
	F  []int   `json:"f"`
	D  []int   `json:"d"`
	C  int     `json:"c"`
}

type client struct {
	Out   chan msgctrl
	Id    int
	Block int
}

// constants
const PORT string = ":8145"

// message types
const (
	MSG_MAP_PAINT        = 0
	MSG_PLAYER_PAINT     = 1
	MSG_PLAYER_MOVE      = 2
	MSG_MAP_COL_PAINT    = 3
	MSG_PLAYER_COL_PAINT = 4
	MSG_PLAYER_REMOVE    = 5
)

// global vars
var clients []*client
var clients_mux = &sync.Mutex{}
var player_id_counter int = 0
var msgin chan msgctrl

// configure websocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func init() {
	// set up our client slice
	clients = make([]*client, 0, 8)
	// set up our inward channel
	msgin = make(chan msgctrl)
}

func main() {
	var err error
	var path string

	// find our path to serve
	if len(os.Args) > 1 {
		path = os.Args[1]
	} else {
		// second check where the executable is
		path, err = os.Executable()
		if err != nil {
			log.Fatal("Err while getting executable path. err: %v\n", err)
		}
		path = filepath.Dir(path) + "/site"
		_, err = os.Stat(path)
		if err != nil {
			// check the current working directory
			path, err = os.Getwd()
			if err != nil {
				log.Fatal("Err while getting working directory. err: %v\n", err)
			}

			path = path + "/site"
			_, err = os.Stat(path)
			if err != nil {
				log.Fatal("Could not find path to site! err: %v\n", err)
			}
		}
	}

	log.Printf("Path = %s\n", path)
	log.Printf("Serving on port %s\n", PORT)

	// handle messages
	go handleMessages()

	// handle websocket connections
	http.HandleFunc("/ws", wsConnection)

	// handle normal file connections
	http.Handle("/", http.FileServer(http.Dir(path)))
	log.Fatal(http.ListenAndServe(PORT, nil))
}

func handleMessages() {
	var msg msgctrl
	for {
		select {
		case msg = <-msgin:
			// TODO process change and send the change to everyone
			switch msg.T {
			case MSG_MAP_PAINT:
				//TODO
			case MSG_MAP_COL_PAINT:
				//TODO
			}

			clients_mux.Lock()
			for _, c := range clients {
				if c.Id != msg.Id {
					c.Out <- msg
				}
			}
			clients_mux.Unlock()
		}
	}
}

func wsConnection(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Error! Problem upgrading connection. err: %v\n", err)
		return
	}
	defer ws.Close()

	log.Printf("connection from %s\n", r.RemoteAddr)

	// create the channel for this client
	var c client
	c.Out = make(chan msgctrl)
	// add it to the global slice

	clients_mux.Lock()
	c.Id = player_id_counter
	player_id_counter++
	clients = append(clients, &c)
	clients_mux.Unlock()

	var msgtype int
	var p []byte
	var msg msgctrl

	// TODO WriteMessage loop
	go func() {
		for {
			msg, ok := <-c.Out
			if !ok {
				break
			}
			jsonmsg, err := json.Marshal(msg)
			if err != nil {
				break
			}
			ws.WriteMessage(1, jsonmsg)
		}
		log.Printf("%d is no longer sending\n", c.Id)
	}()

	// ReadMessage loop
	for {
		msgtype, p, err = ws.ReadMessage()
		if err != nil {
			log.Printf("ws read err: %v\n", err)
			break
		}

		switch msgtype {
		case websocket.TextMessage:
			// unmarshall the message
			err = json.Unmarshal(p, &msg)
			if err != nil {
				log.Printf("unmarshal err: %v\n", err)
				break
			}
			// add the player id to it
			msg.Id = c.Id
			// send it for processing
			msgin <- msg
		case websocket.CloseMessage:
			// one way to end connection
			break
		}
		// ignore other types
	}

	// remove the client from the list of clients
	// first find it
	clients_mux.Lock()
	var ci int
	for ci = 0; ci < len(clients); ci++ {
		if clients[ci] == &c {
			break
		}
	}

	if ci == len(clients) {
		log.Fatal("Could not remove client from the slice!\n")
	}

	clients = append(clients[:ci], clients[ci+1:]...)
	clients_mux.Unlock()

	close(c.Out) // this triggers the end for the out routine

	log.Printf("closed connection from %s\n", r.RemoteAddr)

	// TODO send out a player remove message to everyone
}
