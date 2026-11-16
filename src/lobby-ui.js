
export function createLobbyUI(lobby, root, onJoin) {
    root.innerHTML = `
        <h2>Entrar em uma partida</h2>

        <label for="player-name">Seu nome:</label>
        <input id="player-name" type="text" placeholder="Digite seu nome">

        <h3>Salas disponíveis</h3>
        <div id="room-list">Carregando salas...</div>

        <button id="join-button" disabled>Entrar na sala</button>
    `

    const nameInput = root.querySelector('#player-name')
    const roomList = root.querySelector('#room-list')
    const joinButton = root.querySelector('#join-button')

    let selectedRoomId = null

    lobby.addEventListener('roomsChanged', event => {
        roomList.innerHTML = ''

        for (const room of event.detail) {
            const button = document.createElement('button')
            button.textContent = room.name
            button.type = 'button'

            button.addEventListener('click', () => {
                selectedRoomId = room.id

                roomList.querySelectorAll('button').forEach(item => {
                    item.disabled = false
                })

                button.disabled = true
                joinButton.disabled = false
            })

            roomList.append(button)
        }
    })

    joinButton.addEventListener('click', () => {
        const playerName = nameInput.value.trim()

        if (!playerName || !selectedRoomId) return

        const room = lobby.join(selectedRoomId)
        onJoin({ playerName, room })
    })
}
