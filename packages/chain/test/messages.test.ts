import { TestingAppChain } from "@proto-kit/sdk";
import { Character, CircuitString, Poseidon, PrivateKey } from "o1js";
import { Message, Messages } from "../src/messages";
import { log } from "@proto-kit/common";
import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";

log.setLevel("ERROR");

describe("balances", () => {
  it("should demonstrate how balances work", async () => {
    const appChain = TestingAppChain.fromRuntime({
      Messages,
    });

    appChain.configurePartial({
      Runtime: {
        Balances: {
          totalSupply: UInt64.from(10000),
        },
        Messages: {

        }
      },
    });

    await appChain.start();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();

    
    appChain.setSigner(alicePrivateKey);

    const messages = appChain.runtime.resolve("Messages");

    const testAgentId = UInt64.from(2);

    const securityCodeData = CircuitString.fromCharacters([Character.fromString('a'), Character.fromString('2')])
    const testSecretCodeHash = Poseidon.hash(securityCodeData.toFields());

    const tx1 = await appChain.transaction(alice, () => {
      messages.initAgent(testAgentId, testSecretCodeHash);
    });

    await tx1.sign();
    await tx1.send();

    const block = await appChain.produceBlock();

    const newSecretCode = await appChain.query.runtime.Messages.securityCodeHashes.get(testAgentId);

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(newSecretCode).toEqual(testSecretCodeHash);

    const testMessageNumber = UInt64.from(1);
    const message1 = new Message({
      number: testMessageNumber,
      agentId: testAgentId,
      text: [...Array(12)].map(() => Character.fromString('a')),
      securityCode: securityCodeData,
    });

    const tx2 = await appChain.transaction(alice, () => {
      messages.processMessage(message1);
    });

    await tx2.sign();
    await tx2.send();

    const block2 = await appChain.produceBlock();

    const newMessageId = UInt64.from(await appChain.query.runtime.Messages.lastMessageRecevied.get(testAgentId) || 0);

    expect(block2?.transactions[0].status.toBoolean()).toBe(true);
    expect(newMessageId?.equals(testMessageNumber).toBoolean()).toBe(true);

  }, 1_000_000);
});
