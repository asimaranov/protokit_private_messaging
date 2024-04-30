import { TestingAppChain } from "@proto-kit/sdk";
import { Character, CircuitString, Poseidon, PrivateKey } from "o1js";
import {
  Message,
  MessageVerificationProof,
  MessageVerificationPublicInput,
  MessagesExtended as Messages,
  verifyMessage,
} from "../src/messages";
import { log } from "@proto-kit/common";
import { UInt64 } from "@proto-kit/library";
import { dummyBase64Proof } from "o1js/dist/node/lib/proof_system";
import { Pickles } from "o1js/dist/node/snarky";

log.setLevel("ERROR");

async function mockProof<I, O, P>(
  publicOutput: O,
  ProofType: new ({
    proof,
    publicInput,
    publicOutput,
    maxProofsVerified,
  }: {
    proof: unknown;
    publicInput: I;
    publicOutput: any;
    maxProofsVerified: 0 | 2 | 1;
  }) => P,
  publicInput: I
): Promise<P> {
  const [, proof] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
  return new ProofType({
    proof: proof,
    maxProofsVerified: 2,
    publicInput,
    publicOutput,
  });
}

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
        Messages: {},
      },
    });

    await appChain.start();

    const alicePrivateKey = PrivateKey.random();
    const alice = alicePrivateKey.toPublicKey();

    appChain.setSigner(alicePrivateKey);

    const messages = appChain.runtime.resolve("Messages");

    const testAgentId = UInt64.from(2);

    const securityCodeData = CircuitString.fromCharacters([
      Character.fromString("a"),
      Character.fromString("2"),
    ]);
    const testSecretCodeHash = Poseidon.hash(securityCodeData.toFields());

    const tx1 = await appChain.transaction(alice, () => {
      messages.initAgent(testAgentId, testSecretCodeHash);
    });

    await tx1.sign();
    await tx1.send();

    const block = await appChain.produceBlock();

    const newSecretCode =
      await appChain.query.runtime.Messages.securityCodeHashes.get(testAgentId);

    expect(block?.transactions[0].status.toBoolean()).toBe(true);
    expect(newSecretCode).toEqual(testSecretCodeHash);

    const testMessageNumber = UInt64.from(1);
    const message1 = new Message({
      number: testMessageNumber,
      agentId: testAgentId,
      text: [...Array(12)].map(() => Character.fromString("a")),
      securityCode: securityCodeData,
    });

    const publicInput = new MessageVerificationPublicInput({
      securityCodeHash: testSecretCodeHash,
    });

    const verificationOutput = verifyMessage(publicInput, message1);

    const verificationProof = await mockProof(verificationOutput, MessageVerificationProof, publicInput);

    const tx2 = await appChain.transaction(alice, () => {
      messages.processMessage(message1.number, message1.agentId, verificationProof);
    });

    await tx2.sign();
    await tx2.send();

    const block2 = await appChain.produceBlock();

    const newMessageId = UInt64.from(
      (await appChain.query.runtime.Messages.lastMessageRecevied.get(
        testAgentId
      )) || 0
    );

    expect(block2?.transactions[0].status.toBoolean()).toBe(true);
    expect(newMessageId?.equals(testMessageNumber).toBoolean()).toBe(true);
  }, 1_000_000);
});
