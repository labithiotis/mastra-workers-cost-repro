import { runRepro } from './repro';

export default {
  async fetch() {
    return Response.json(await runRepro());
  },
};
