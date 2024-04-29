import { Balance } from "@proto-kit/library";
import { Balances } from "./balances";
import { Messages } from "./messages";

import { ModulesConfig } from "@proto-kit/common";

export const modules = {
  Balances,
  Messages
};

export const config: ModulesConfig<typeof modules> = {
  Balances: {
    totalSupply: Balance.from(10_000),
  },
  Messages: {
    
  }
};

export default {
  modules,
  config,
};
