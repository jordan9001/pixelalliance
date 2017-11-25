package main

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

// types
type msgctrl struct {
	Id int      `json:"id"`
	T  int      `json:"t"`
	Px float64  `json:"px"`
	Py float64  `json:"py"`
	X  int      `json:"x"`
	Y  int      `json:"y"`
	F  []int    `json:"f"`
	C  int      `json:"c"`
	S  bool     `json:"s"`
	M  []mapint `json:"m"`
}

type client struct {
	Out chan msgctrl
	Id  int
	Px  float64
	Py  float64
}

// constants
const PORT string = ":8145"
const TIMEOUTTIME time.Duration = 15 * time.Second

// message types
const (
	MSG_MAP_PAINT        = 0
	MSG_PLAYER_PAINT     = 1
	MSG_PLAYER_MOVE      = 2
	MSG_MAP_COL_PAINT    = 3
	MSG_PLAYER_COL_PAINT = 4
	MSG_PLAYER_REMOVE    = 5
	MSG_PLAYER_MAP       = 6
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
	var path string
	var statepath string

	// find our path to serve
	if len(os.Args) > 2 {
		path = os.Args[1]
		statepath = os.Args[2]
	} else {
		log.Fatalf("Usage: %s /path/to/site /path/to/statefile [logfile]\n", os.Args[0])
	}

	if len(os.Args) > 3 {
		f, err := os.OpenFile(os.Args[3], os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			log.Fatal(err)
		}
		defer f.Close()

		log.SetOutput(f)
	}

	log.Printf("Path = %s\n", path)
	log.Printf("Serving on port %s\n", PORT)

	state_init(statepath)

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
				update_map(msg.X, msg.Y, msg.C, msg.F)
			case MSG_PLAYER_PAINT:
				update_player(msg.Id, msg.X, msg.Y, msg.C, msg.F)
			case MSG_PLAYER_MOVE:
				clients_mux.Lock()
				for _, c := range clients {
					if c.Id == msg.Id {
						c.Px = msg.Px
						c.Py = msg.Py
						break
					}
				}
				clients_mux.Unlock()
			case MSG_MAP_COL_PAINT:
				update_col_map(msg.X, msg.Y, msg.C, msg.F)
			case MSG_PLAYER_COL_PAINT:
				update_col_player(msg.Id, msg.X, msg.Y, msg.C, msg.F)
			case MSG_PLAYER_REMOVE:
				// remove the player map from the state
				clear_state(msg.Id)
			case MSG_PLAYER_MAP:
				update_player_map(msg.Id, msg.M)
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

	// start sending PING messages
	go func() {
		for {
			err := ws.WriteMessage(websocket.PingMessage, []byte("keepalive"))
			if err != nil {
				return
			}
			time.Sleep(TIMEOUTTIME)
		}
	}()

	// create the channel for this client
	var c client
	c.Px = 0.0
	c.Py = 0.0
	c.Out = make(chan msgctrl)
	// add it to the global slice

	clients_mux.Lock()
	c.Id = player_id_counter
	player_id_counter++
	if player_id_counter == -1 {
		// -1 is only for the server
		log.Printf("WARNING! Looped all the way around! Hope player 0 isn't still around\n")
		player_id_counter++
	}
	clients = append(clients, &c)
	clients_mux.Unlock()

	log.Printf("Connection for %d from %s\n", c.Id, r.RemoteAddr)
	log.Printf("There are %d connections\n", len(clients))

	var msgtype int
	var p []byte
	var msg msgctrl

	// Get this client up to date
	go send_updates(c)

	// WriteMessage loop
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
		case websocket.PingMessage:
			log.Printf("Ping\n")
		case websocket.PongMessage:
			log.Printf("Pong\n")
		case websocket.CloseMessage:
			// one way to end connection
			break
		}
		// ignore other types
	}

	// remove the client from the list of clients
	// first find it
	var ci int
	var found bool = false
	clients_mux.Lock()
	for ci = 0; ci < len(clients); ci++ {
		if clients[ci] == &c {
			found = true
			break
		}
	}

	if !found {
		log.Fatal("Could not remove client from the slice!\n")
	}

	clients = append(clients[:ci], clients[ci+1:]...)
	clients_mux.Unlock()

	close(c.Out) // this triggers the end for the out routine

	log.Printf("closed connection for player %d from %s\n", c.Id, r.RemoteAddr)

	// TODO send out a player remove message to everyone
	msgin <- msgctrl{
		Id: c.Id,
		T:  MSG_PLAYER_REMOVE,
	}

}
