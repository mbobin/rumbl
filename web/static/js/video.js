import Player from "./player"
import {Presence} from "phoenix"

let Video = {

  init(socket, element) {
    if (!element) { return }

    let playerId = element.getAttribute("data-player-id")
    let videoId = element.getAttribute("data-id")

    socket.connect()
    Player.init(element.id, playerId, () => {
      this.onReady(videoId, socket)
    })
  },

  onReady(videoId, socket) {
    let msgContainer  = document.getElementById("msg-container")
    let msgInput      = document.getElementById("msg-input")
    let postButton    = document.getElementById("msg-submit")
    let vidChannel    = socket.channel("videos:" + videoId)
    let usrContainer  = document.getElementById("usr-container")
    let presences     = {}

    postButton.addEventListener("click", e => {
      let payload = { body: msgInput.value, at: Player.getCurrentTime()}
      vidChannel.push("new_annotation", payload)
        .receive("error", e => console.log(e))
      msgInput.value = ""
    })

    msgContainer.addEventListener("click", e => {
      e.preventDefault()

      let seconds = e.target.getAttribute("data-seek") || e.target.parentNode.getAttribute("data-seek")
      if(!seconds) { return }

      Player.seekTo(seconds)
    })

    let onJoin = (id, current, newPres) => {
      if(current){ return }
      this.renderPresence(id, newPres, usrContainer)
    }

    let onLeave = (id, current, leftPres) => {
      if(current.metas.length === 0) {
        let child = document.getElementById(id)
        usrContainer.removeChild(child)
      }
    }

    vidChannel.on("new_annotation", (resp) => {
      vidChannel.params.last_seen_id = resp.id
      this.renderAnnotation(msgContainer, resp)
    })

    vidChannel.join()
      .receive("ok", resp => console.log("join success", resp))
      .receive("error", reason => console.log("join failed", reason))

    vidChannel.on("annotations", resp => {
      let ids = resp.annotations.map(ann => ann.id)
      if(ids.length > 0) { vidChannel.params.last_seen_id = Math.max(...ids) }
      this.scheduleMessages(msgContainer, resp.annotations)
    })

    vidChannel.on("presence_state", state => {
      presences = Presence.syncState(presences, state, onJoin, onLeave)
    })

    vidChannel.on("presence_diff", diff => {
      presences = Presence.syncDiff(presences, diff, onJoin, onLeave)
    })
  },

  esc(str) {
    let div = document.createElement("div")
    div.appendChild(document.createTextNode(str))
    return div.innerHTML
  },

  renderAnnotation(msgContainer, {user, body, at}) {
    let template = document.createElement("div")
    template.innerHTML = `
    <a href="#" data-seek="${this.esc(at)}">
      [${this.formatTime(at)}]
      <b>${this.esc(user.username)}</b>: ${this.esc(body)}
    </a>
    `
    msgContainer.appendChild(template)
    msgContainer.scrollTop = msgContainer.scrollHeight
  },

  scheduleMessages(msgContainer, annotations) {
    setTimeout(()=> {
      let ctime = Player.getCurrentTime()
      let remaining = this.renderAtTime(annotations, ctime, msgContainer)
      this.scheduleMessages(msgContainer, remaining)
    }, 1000)
  },

  renderAtTime(annotations, seconds, msgContainer) {
    return annotations.filter( ann => {
      if(ann.at > seconds) {
        return true
      } else {
        this.renderAnnotation(msgContainer, ann)
        return false
      }
    })
  },

  formatTime(at) {
    let date = new Date(null)
    date.setSeconds(at / 1000)
    return date.toISOString().substr(14,5)
  },

  listBy({metas: metas, user: user}) {
    let timestamp = new Date(metas[0].online_at)
    return {
      onlineAt: timestamp.toLocaleTimeString(),
      username: user.username
    }
  },

  syncUsers(presence, usrContainer) {
    usrContainer.innerHTML = ""
    Presence.list(presences, this.listBy).map(presence => { this.renderUser(presence, usrContainer) })
  },

  renderPresence(id, presence, usrContainer) {
    let user = this.buildUser(id, presence)
    this.renderUser(user, usrContainer)
  },

  buildUser(id, {user: user, metas: metas}) {
    let timestamp = new Date(metas[0].online_at)
    return {
      onlineAt: timestamp.toLocaleTimeString(),
      username: user.username,
      id: id
    }
  },

  renderUser(presence, usrContainer) {
    let template = document.createElement("li")
    template.setAttribute("class", "list-group-item")
    template.setAttribute("id", this.esc(presence.id))
    template.innerHTML =  `
      <div>${this.esc(presence.username)}</div>
      <small>since ${presence.onlineAt}</small>
    `
    usrContainer.appendChild(template)
    usrContainer.scrollTop = usrContainer.scrollHeight
  },
}

export default Video
