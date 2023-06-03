import { createHelia } from 'helia'
import { React, useState, useEffect } from 'react'

import {createLibp2p} from "libp2p";
import {webSockets} from "@libp2p/websockets"
import { webRTCStar } from '@libp2p/webrtc-star'
import { webRTC } from '@libp2p/webrtc'
import { bootstrap } from '@libp2p/bootstrap'
import {noise} from "@chainsafe/libp2p-noise"
import {mplex} from "@libp2p/mplex"
import { multiaddr } from 'multiaddr'
import {gossipsub, GossipSub} from "@chainsafe/libp2p-gossipsub"
import { kadDHT } from '@libp2p/kad-dht'
import { floodsub } from '@libp2p/floodsub'
import { pubsubPeerDiscovery, TOPIC as ppdTopic } from '@libp2p/pubsub-peer-discovery'

// gossip reference: https://github.com/nuel77/libp2p-mulitlang-gossip/blob/main/browser-node/src/App.js
// another libp2p: https://gitlab.com/abyssnet/abyssnet/-/blob/main/src/plugins/p2pnode.js

const IpfsComponent = () => {
  const [id, setId] = useState(null)
  const [helia, setHelia] = useState(null)
  const [isOnline, setIsOnline] = useState(false)
  const [peersCount, setPeersCount] = useState(0)
  const [message, setMessage] = useState(null)
//  const bootstraps = [
//     add nodes
//  ]

  async function sendGossip() {
    try {
      let encoder = new TextEncoder()
      await helia.libp2p.services.pubsub.publish('chat-gossip', encoder.encode(message))
    } catch(err) {
      console.error(`error ${err}`)
    }
  }

  async function getPeersConnected(helia) {
    let peers = await helia.libp2p.services.pubsub.getPeers()
    console.log(`checking peers ${peers}`)
    setPeersCount(peers.length);
    return peers;
  }

  const createNode = async () => {
    const wrtcStar = webRTCStar()
    const node = await createLibp2p({
      addresses: {
        listen: [
            "/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star",
            "/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star",
            '/webrtc',
            '/ip4/127.0.0.1/tcp/ws'
        ]
      },
      transports: [
        webSockets(),
        webRTC(),
        wrtcStar.transport
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [mplex()],
      peerDiscovery: [
//        wrtcStar.discovery,
        pubsubPeerDiscovery({
          topics: ['chat-gossip', 'test-dforms-hackfs', '_peer-discovery._p2p._pubsub']
        }),

//        bootstrap({
//          interval: 100,
//          list: bootstraps
//        })
      ],
      services: {
        pubsub: gossipsub({
          doPX: false,
          emitSelf: true,
          fallbackToFloodsub: true,
          floodPublish: true,
          canRelayMessage: true,
          allowPublishToZeroPeers: true,
          directConnectTicks: 60,
//          directPeers: [dirPeer('12D3KooWEbDVySzmBvBVUGdyWx46qC5u2z32M41YeBXtkpYbpjVn')],
          maxInboundStreams: 4,
          maxOutboundStreams: 2,
          mcacheGossip: 10,
          mcacheLength: 30,
          fanoutTTL: 5*60e3,
          seenTTL: 10*60e3,
        }),
      },
      dht: kadDHT(),
      relay: {
        advertise: {
          enabled: false,
        },
        hop: {
          enabled: false,
        },
        autoRelay: {
          enabled: true,
        },
        enabled: true,
      },
      nat: {
        enabled: true
      },
      connectionManager: {
        autoDial: true,
        maxConnections: Infinity,
        maxEventLoopDelay: Infinity,
      },
      peerStore: {
        persistence: false,
        threshold: 0
      },
      peerRouting: {
        refreshManager: {
          enabled: true,
        }
      },
  
    })
    node.addEventListener('peer:connect', (evt) => {
      const connection = evt.detail
      console.log('Connection established to:', connection)	// Emitted when a peer has been found
    })
    node.addEventListener('peer:discovery', (evt) => {
      const peer = evt.detail
      // No need to dial, autoDial is on
      // console.log('Discovered:', peer.id.toString())
    })
    
    await node.start()
    console.log("node started : ", node.peerId.toCID().toString())
    // print out listening addresses
    const listenAddrs = node.getMultiaddrs()
    console.log('listening on addresses:', listenAddrs.map(i=>i.toString()))

  }

  useEffect(() => {
    const init = async () => {
      if (helia) return

      let libp2p_node = await createNode()
      const heliaNode = await createHelia({
//        datastore,
//        blockstore,
        libp2p: libp2p_node
      })

      const nodeId = heliaNode.libp2p.peerId.toString()
      const nodeIsOnline = heliaNode.libp2p.isStarted()

      setHelia(heliaNode)
      setId(nodeId)
      setIsOnline(nodeIsOnline)
      if (heliaNode?.libp2p?.pubsub) {
        heliaNode.libp2p.services.pubsub.addEventListener("message", (evt) => {
          const decoder = new TextDecoder()
          let msg = decoder.decode(evt.detail.data)
          console.log(`message: ${msg} on topic ${evt.detail.topic}`)
        })
      }

    // set interval to check and update peers connected
      window.setInterval(() => getPeersConnected(heliaNode), 10000);  
    }

    init()
  }, [helia])

  if (!helia || !id) {
    return <h4>Connecting to IPFS...</h4>
  }

  return (
    <div>
      <h4 data-test="id">ID: {id.toString()}</h4>
      <h4 data-test="status">Status: {isOnline ? 'Online' : 'Offline'}</h4>
      <h4 data-test="status">Peers connected: {isOnline ? peersCount : 'Disconnected'}</h4>
      <input 
        onChange={setMessage}
      />
      <button
        onClick={() => sendGossip()}
      >Send!</button>
    </div>
  )
}

export default IpfsComponent
