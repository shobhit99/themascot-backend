import { Container } from "@cloudflare/containers";
import openNextWorker from "./.open-next/worker.js";

export {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

export class VideoProcessorContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";
  enableInternet = false;
}

export default openNextWorker;
