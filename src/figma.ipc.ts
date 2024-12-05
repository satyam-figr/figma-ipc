import { DeferredPromise } from "./deferred.promise.class";

export type ReceiverFn<R> = (...data: any) => R;

export const enum FigmaOriginType {
  NULL = "null",
  NON_NULL = "non_null",
}

type NonNullInitiationOptions = {
  originType: FigmaOriginType.NON_NULL;
  pluginId: string;
  mainHost: string;
  targetOrigin?: string;
};

type NullInitiationOptions = {
  originType: FigmaOriginType.NULL;
  pluginId?: never;
};

type InitiationOptions = NonNullInitiationOptions | NullInitiationOptions;

type MessageBase = {
  type: "call" | "response" | "error";
  id: number;
  name: string;
};

type CallMessage = MessageBase & {
  type: "call";
  data: any;
};

type ResponseMessage = MessageBase & {
  type: "response";
  data: any;
};

type ErrorMessage = MessageBase & {
  type: "error";
  errorJSON: string;
};

type ConnectMessage = {
  type: "connect";
};

type Message = CallMessage | ResponseMessage | ErrorMessage | ConnectMessage;

// this object will store the created promises corresponding to their ids
const promisesByID: Record<number, DeferredPromise<any>> = {};
const receiverByName: Record<string, ReceiverFn<unknown>> = {};
// array of post messages
const postQueue: Message[] = [];
const receiveQueue = new Set<CallMessage>();
const msgString =
  "You must call initiationIpc() before calling any other functions.";

// initialize the current id
let currentID = 0;
// this will store the post method later. this will take message as parameter and returns nothing
let post: (message: Message) => void;

let isConnected = false;

export function call<T>(name: string, ...data: any[]) {
  if (!post) {
    throw new Error(msgString);
  }

  const id = currentID++;
  const promise = new DeferredPromise<T>();
  promisesByID[id] = promise;
  post({ type: "call", id, name, data });
  // post message hone ke baad promise return karega;
  return promise;
}

// receiver function do chij lega . pahela name and dusra a callbackfunction
export function receive<R>(name: string, fn: ReceiverFn<R>) {
  // sabse pahele callback function ko receiverByName me store karlo
  receiverByName[name] = fn;

  setTimeout(async () => {
    for (const message of receiveQueue) {
      if (message.name === name) {
        receiveQueue.delete(message);
        await handleCall(message);
      }
    }
  });
}

//

export function ignore(name: string) {
  delete receiverByName[name];
}

export function initiationIpc(options: InitiationOptions) {
  const figmaToMainOptions: UIPostMessageOptions = {};
  const mainToFigmaOptions: { pluginId?: string } = {};
  let mainToFigmaTargetOrigin: string = "*";
  switch (options.originType) {
    case FigmaOriginType.NON_NULL: {
      if (!options.targetOrigin) {
        options.targetOrigin = "https://www.figma.com";
      }
      figmaToMainOptions.origin = options.mainHost;
      mainToFigmaOptions.pluginId = options.pluginId;
      mainToFigmaTargetOrigin = options.targetOrigin;
    }
  }

  if (typeof window === "undefined") {
    post = (message: Message) => {
      if (isConnected) {
        figma.ui.postMessage(message, figmaToMainOptions);
      } else {
        postQueue.push(message);
      }
    };
  } else {
    post = (message: Message) => {
      window.parent.postMessage(
        { pluginMessage: message, ...mainToFigmaOptions },
        mainToFigmaTargetOrigin
      );
    };

    addEventListener("message", ({ data: { pluginMessage } }) => {
      if (pluginMessage && typeof pluginMessage === "object") {
        return handleMessage(pluginMessage);
      }
    });

    post({ type: "connect" });
  }
}

async function handleCall(message: CallMessage) {
  if (!post) {
    throw new Error(msgString);
  }
  if (message?.name in receiverByName) {
    const { id, name, data } = message;
    const receiver = receiverByName[name];
    try {
      const response = await receiver(...data);
      post({ type: "response", id, name, data: response });
    } catch (error) {
      const errorJSON = JSON.stringify(
        error,
        Object.getOwnPropertyNames(error)
      );
      post({ type: "error", id, name, errorJSON });
    }
  } else {
    receiveQueue.add(message);
  }
}

function handleResponse(message: ResponseMessage) {
  if (message?.id in promisesByID) {
    const { id, data } = message;
    const promise = promisesByID[id];
    promise.resolve(data);
  }
}

function handleError(message: ErrorMessage) {
  if (message?.id in promisesByID) {
    const { id, errorJSON } = message;
    const promise = promisesByID[id];

    const { message: errorMessage, ...reset } = JSON.parse(errorJSON);
    const error = new Error(errorMessage, { cause: rest });
    promise.reject(error);
  }
}

function handleConnect() {
  if (!post) {
    throw new Error(msgString);
  }

  isConnected = true;
  if (postQueue.length) {
    postQueue.forEach((message) => {
      post(message);
    });
    postQueue.length = 0;
  }
}

async function handleMessage(message: Message) {
  if (!post) {
    throw new Error(msgString);
  }

  if (!message || typeof message !== "object") {
    return;
  }

  switch (message.type) {
    case "call":
      await handleCall(message);
      break;

    case "response":
      handleResponse(message);
      break;

    case "error":
      handleError(message);
      break;

    case "connect":
      handleConnect();
      break;
  }
}
