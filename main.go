package main

import (
	"github.com/gorilla/websocket"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

// types
type msgctrl struct {
	msg []byte
}
type client struct {
	Out chan msgctrl
}

// constants
const PORT string = ":8145"

// global vars
var clients []*client
var clients_mux = &sync.Mutex{}

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
	// first check where the executable is
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
			log.Printf("Message : %q\n", msg)
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
	clients = append(clients, &c)
	clients_mux.Unlock()

	var msgtype int
	var p []byte
	for {
		msgtype, p, err = ws.ReadMessage()
		if err != nil {
			log.Printf("ws read err: %v\n", err)
			break
		}

		switch msgtype {
		case websocket.TextMessage:
			log.Printf("Got Message %q\n", p)
			msgin <- msgctrl{msg: p}
		case websocket.CloseMessage:
			// one way to end connection
			break
		}
		// ignore other type
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

	close(c.Out)

	log.Printf("closed connection from %s\n", r.RemoteAddr)
}
