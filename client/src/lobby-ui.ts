import type {RoomInfo} from '@dogfight/shared/protocol';
import {RoomListSchema} from '@dogfight/shared/protocol';
import type {Lobby} from './lobby.ts';
import type {Connection} from './connection.ts';

export function createLobbyUI(lobby:Lobby, root:HTMLElement, onJoin:(data:{playerName:string;room:RoomInfo})=>void):void {
    root.innerHTML = `
    <h2>Join a Match</h2>

    <label for="player-name">Player Name</label>
    <input
      id="player-name"
      type="text"
      maxlength="30"
      placeholder="Enter your name"
    >

    <h3>Available Rooms</h3>
    <div id="room-list">Loading rooms...</div>

    <h3>Create a Room</h3>
    <input
      id="room-name"
      type="text"
      maxlength="50"
      placeholder="Room name"
    >
    <button id="create-room" type="button">Create Room</button>

    <button id="join-button" type="button" disabled>
      Join Room
    </button>

    <p id="lobby-error" role="alert"></p>
  `;

    const nameInput = root.querySelector('#player-name');
    const roomList = root.querySelector('#room-list');
    const joinButton = root.querySelector('#join-button');
    const createButton = root.querySelector('#create-room');
    const roomNameInput = root.querySelector('#room-name');
    const errorElement = root.querySelector('#lobby-error');
    if (!(nameInput instanceof HTMLInputElement) || !(roomNameInput instanceof HTMLInputElement) || !(roomList instanceof HTMLElement) || !(joinButton instanceof HTMLButtonElement) || !(createButton instanceof HTMLButtonElement) || !(errorElement instanceof HTMLElement)) throw new Error('Lobby UI elements not found');

    let selectedRoomId: string | null = null;

    lobby.addEventListener('roomsChanged', event => {
        if (!(event instanceof CustomEvent)) return;
        const result=RoomListSchema.safeParse(event.detail);
        if(!result.success)return;
        const rooms=result.data;
        roomList.replaceChildren();

        if (rooms.length === 0) {
            roomList.textContent = 'No rooms available.';
        }

        for (const room of rooms) {
            const button = document.createElement('button');

            button.textContent = room.name;
            button.type = 'button';
            button.disabled = room.id === selectedRoomId;

            button.addEventListener('click', () => {
                selectedRoomId = room.id;

                roomList.querySelectorAll('button').forEach(item => {
                    item.disabled = item === button;
                });

                joinButton.disabled = false;
                errorElement.textContent = '';
            });

            roomList.append(button);
        }

        if (!rooms.some(room => room.id === selectedRoomId)) {
            selectedRoomId = null;
            joinButton.disabled = true;
        }
    });

    createButton.addEventListener('click', () => {
      void (async () => {
        const name = roomNameInput.value.trim();

        if (name.length < 3) {
            errorElement.textContent = 'Room name must contain at least 3 characters.';
            return;
        }

        createButton.disabled = true;
        errorElement.textContent = '';

        try {
            const room = await lobby.createRoom(name);

            selectedRoomId = room.id;
            roomNameInput.value = '';

            await lobby.refresh();
            joinButton.disabled = false;
        } catch (error) {
            errorElement.textContent = error instanceof Error ? error.message : String(error);
        } finally {
            createButton.disabled = false;
        }
      })();
    });

    joinButton.addEventListener('click', () => {
        const playerName = nameInput.value.trim();

        if (!playerName || !selectedRoomId) {
            errorElement.textContent = 'Enter your name and select a room.';
            return;
        }

        if (playerName.length > 30) {
            errorElement.textContent = 'Player name is too long.';
            return;
        }

        try {
            const room = lobby.join(selectedRoomId);
            onJoin({ playerName, room });
        } catch (error) {
            errorElement.textContent = error instanceof Error ? error.message : String(error);
        }
    });
}

export function createMatchUI(root:HTMLElement, connection:Connection):void {
    root.innerHTML = `
    <h3>Players in Room</h3>
    <ul id="player-roster"></ul>

    <h3>Chat</h3>
    <div id="chat-messages" aria-live="polite"></div>

    <form id="chat-form">
      <input
        id="chat-input"
        type="text"
        maxlength="500"
        placeholder="Type a message..."
        required
      >
      <button type="submit">Send</button>
    </form>

    <p id="connection-status">Connecting...</p>
  `;

    const roster = root.querySelector('#player-roster');
    const messages = root.querySelector('#chat-messages');
    const form = root.querySelector('#chat-form');
    const input = root.querySelector('#chat-input');
    const status = root.querySelector('#connection-status');
    if (!(roster instanceof HTMLElement) || !(messages instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(status instanceof HTMLElement)) throw new Error('Match UI elements not found');

    connection.on('roster', data => {
        roster.replaceChildren();

        for (const player of data.players) {
            const item = document.createElement('li');
            item.textContent = player.name;
            roster.append(item);
        }
    });

    connection.on('chat', data => {
        const item = document.createElement('p');
        item.textContent = `${data.playerName}: ${data.message}`;
        messages.append(item);
    });

    connection.on('open', () => {
        status.textContent = 'Connected';
    });

    connection.on('close', () => {
        status.textContent = 'Disconnected. Reconnecting...';
        roster.replaceChildren();
    });

    form.addEventListener('submit', event => {
        event.preventDefault();

        const message = input.value.trim();
        if (!message) return;

        connection.send({ type: 'chat', message });
        input.value = '';
    });
}
