import {
  runtimeModule,
  state,
  runtimeMethod,
  RuntimeModule,
} from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { UInt64 } from "@proto-kit/library";
import {
  Character,
  CircuitString,
  Experimental,
  Field,
  Poseidon,
  Provable,
  PublicKey,
  Struct,
} from "o1js";

export class MessageVerificationPublicInput extends Struct({
  securityCodeHash: Field,
}) {}

export class MessageVerificationPublicOutput extends Struct({}) {}

interface MessagesConfig {}
export class Message extends Struct({
  number: UInt64,
  agentId: UInt64,
  text: Provable.Array(Character, 12),
  securityCode: CircuitString,
}) {}

export const verifyMessage = (
  publicInput: MessageVerificationPublicInput,
  message: Message
) => {
  assert(
    Poseidon.hash((message.securityCode as CircuitString).toFields()).equals(
      publicInput.securityCodeHash
    ),
    "Invalid secret value"
  );
  return new MessageVerificationPublicOutput({});
};

const MessageVerification = Experimental.ZkProgram({
  publicInput: MessageVerificationPublicInput,
  publicOutput: MessageVerificationPublicOutput,
  methods: {
    createProof: {
      privateInputs: [Message],
      method: verifyMessage,
    },
  },
});

export class MessageVerificationProof extends Experimental.ZkProgram.Proof(
  MessageVerification
) {}

export class AgentMetaInfo extends Struct({
  blockHeight: UInt64,
  sender: PublicKey,
  nonce: UInt64,
}) {}

@runtimeModule()
export class Messages extends RuntimeModule<MessagesConfig> {
  @state() public lastMessageRecevied = StateMap.from<UInt64, UInt64>(
    UInt64,
    UInt64
  );
  @state() public securityCodeHashes = StateMap.from<UInt64, Field>(
    UInt64,
    Field
  );

  @runtimeMethod()
  public initAgent(agentId: UInt64, securityCodeHash: Field) {
    this.securityCodeHashes.set(agentId, securityCodeHash);
  }
}

@runtimeModule()
export class MessagesExtended extends Messages {
  @state() public agentsMeta = StateMap.from<UInt64, AgentMetaInfo>(
    UInt64,
    AgentMetaInfo
  );

  @runtimeMethod()
  public processMessage(
    messageNumber: UInt64,
    agentId: UInt64,
    verificationProof: MessageVerificationProof
  ): void {
    const securityCodeHash = this.securityCodeHashes.get(agentId);
    assert(securityCodeHash.isSome, "Incorrect agent id");
    assert(
      messageNumber.greaterThan(
        UInt64.from(this.lastMessageRecevied.get(agentId).value)
      )
    );
    verificationProof.verify();

    this.agentsMeta.set(
      agentId,
      new AgentMetaInfo({
        blockHeight: UInt64.from(this.network.block.height),
        sender: this.transaction.sender.value,
        nonce: UInt64.from(this.transaction.nonce.value),
      })
    );

    this.lastMessageRecevied.set(agentId, messageNumber);
  }
}
