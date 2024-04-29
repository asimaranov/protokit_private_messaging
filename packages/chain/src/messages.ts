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
  Field,
  Poseidon,
  Provable,
  PublicKey,
  Struct,
} from "o1js";

interface MessagesConfig {}

export class Message extends Struct({
  number: UInt64,
  agentId: UInt64,
  text: Provable.Array(Character, 12),
  securityCode: CircuitString,
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

  @runtimeMethod()
  public processMessage(message: Message): void {
    const securityCodeHash = this.securityCodeHashes.get(message.agentId);
    assert(securityCodeHash.isSome, "Incorrect agent id");
    assert(
      Poseidon.hash((message.securityCode as CircuitString).toFields()).equals(
        securityCodeHash.value
      ),
      "Invalid secret value"
    );
    assert(
      message.number.greaterThan(
        UInt64.from(this.lastMessageRecevied.get(message.agentId).value)
      )
    );

    this.lastMessageRecevied.set(message.agentId, message.number);
  }
}
