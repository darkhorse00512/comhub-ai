declare module 'ari-client' {
  import { EventEmitter } from 'events';

  interface ARIClientConfig {
    url: string;
    username: string;
    password: string;
  }

  interface Channel {
    id: string;
    name: string;
    state: string;
    caller: {
      number: string;
      name: string;
    };
    connected: {
      number: string;
      name: string;
    };
    accountcode: string;
    dialplan: {
      context: string;
      exten: string;
      priority: number;
    };
    creationtime: string;
    language: string;
  }

  interface Bridge {
    id: string;
    technology: string;
    bridge_type: string;
    bridge_class: string;
    creator: string;
    name: string;
    channels: string[];
  }

  interface Recording {
    name: string;
    format: string;
    state: string;
    duration?: number;
  }

  interface Playback {
    id: string;
    media_uri: string;
    state: string;
  }

  interface StasisStartEvent {
    type: string;
    timestamp: string;
    args: string[];
    channel: Channel;
    application: string;
  }

  interface ChannelStateChangeEvent {
    type: string;
    timestamp: string;
    channel: Channel;
    application: string;
  }

  interface ChannelDestroyedEvent {
    type: string;
    timestamp: string;
    channel: Channel;
    cause: number;
    cause_txt: string;
    application: string;
  }

  interface ARIClient extends EventEmitter {
    start(appName: string): Promise<void>;
    channels: {
      list(): Promise<Channel[]>;
      get(params: { channelId: string }): Promise<Channel>;
      originate(params: {
        endpoint: string;
        app: string;
        appArgs?: string;
        callerId?: string;
        timeout?: number;
        variables?: Record<string, string>;
      }): Promise<Channel>;
      hangup(params: { channelId: string }): Promise<void>;
      answer(params: { channelId: string }): Promise<void>;
      record(params: {
        channelId: string;
        name: string;
        format: string;
        maxDurationSeconds?: number;
        maxSilenceSeconds?: number;
        ifExists?: string;
        beep?: boolean;
        terminateOn?: string;
      }): Promise<Recording>;
      play(params: {
        channelId: string;
        media: string | string[];
        lang?: string;
        offsetms?: number;
        skipms?: number;
        playbackId?: string;
      }): Promise<Playback>;
    };
    bridges: {
      list(): Promise<Bridge[]>;
      create(params: { type: string; name?: string }): Promise<Bridge>;
      destroy(params: { bridgeId: string }): Promise<void>;
      addChannel(params: { bridgeId: string; channel: string | string[] }): Promise<void>;
      removeChannel(params: { bridgeId: string; channel: string | string[] }): Promise<void>;
    };
    recordings: {
      listStored(): Promise<Recording[]>;
      getStored(params: { recordingName: string }): Promise<Recording>;
      deleteStored(params: { recordingName: string }): Promise<void>;
      getLive(params: { recordingName: string }): Promise<Recording>;
      cancel(params: { recordingName: string }): Promise<void>;
      stop(params: { recordingName: string }): Promise<void>;
      pause(params: { recordingName: string }): Promise<void>;
      unpause(params: { recordingName: string }): Promise<void>;
      mute(params: { recordingName: string }): Promise<void>;
      unmute(params: { recordingName: string }): Promise<void>;
    };
    playbacks: {
      get(params: { playbackId: string }): Promise<Playback>;
      stop(params: { playbackId: string }): Promise<void>;
      control(params: { playbackId: string; operation: string }): Promise<void>;
    };
    on(event: 'stasisStart', callback: (event: StasisStartEvent, channel: Channel) => void): this;
    on(event: 'channelStateChange', callback: (event: ChannelStateChangeEvent, channel: Channel) => void): this;
    on(event: 'channelDestroyed', callback: (event: ChannelDestroyedEvent, channel: Channel) => void): this;
    on(event: string, callback: (...args: any[]) => void): this;
  }

  function connect(url: string, username: string, password: string): Promise<ARIClient>;
  function connect(config: ARIClientConfig): Promise<ARIClient>;

  export = {
    connect,
  };
}
