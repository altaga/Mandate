import { BigInt, BigDecimal, Bytes, Address } from "@graphprotocol/graph-ts";
import { UserOperationEvent as UserOperationEventEvent } from "../generated/EntryPoint/EntryPoint";
import { UserOperation, VendorReputation } from "../generated/schema";

// EntryPoint.handleOps(UserOperation[] ops, address payable beneficiary)
const HANDLE_OPS_SELECTOR_LEN = 4;
// SimpleAccount.execute(address dest, uint256 value, bytes func) — 0xb61d27f6
const EXECUTE_SELECTOR_LEN = 4;
const WORD = 32;

function readWord(data: Uint8Array, offset: i32): Uint8Array {
  return data.slice(offset, offset + WORD);
}

// ABI words are big-endian; graph-ts's BigInt.fromUnsignedBytes expects
// little-endian, so reverse before converting.
function wordToBigInt(word: Uint8Array): BigInt {
  let le = new Uint8Array(word.length);
  for (let i = 0; i < word.length; i++) {
    le[i] = word[word.length - 1 - i];
  }
  return BigInt.fromUnsignedBytes(Bytes.fromUint8Array(le));
}

function wordToAddress(word: Uint8Array): Address {
  return Address.fromBytes(Bytes.fromUint8Array(word.slice(12, 32)));
}

class ExecuteCall {
  vendor: Address;
  amount: BigInt;
  constructor(vendor: Address, amount: BigInt) {
    this.vendor = vendor;
    this.amount = amount;
  }
}

/**
 * Manual ABI decoding of EntryPoint.handleOps(UserOperation[], address) down
 * to the vendor + amount of the matching UserOp's own SimpleAccount.execute
 * (address dest, uint256 value, bytes) call — i.e. who Mandate's agent
 * actually paid on-chain, read from the real transaction, not trusted from
 * our own backend.
 *
 * graph-node's generic ethereum.decode() cannot decode a dynamic array of
 * tuples that themselves contain more than one dynamic field — confirmed
 * empirically: it returned null on this exact real handleOps calldata, which
 * ethers.js (and this hand-rolled walk of the standard Solidity ABI
 * head/tail layout) decodes correctly. See docs/ARCHITECTURE.md for the
 * verified byte offsets this was checked against.
 */
function decodeVendorPayment(
  txInput: Uint8Array,
  expectedSender: Address,
  expectedNonce: BigInt
): ExecuteCall | null {
  if (txInput.length <= HANDLE_OPS_SELECTOR_LEN) return null;
  let args = txInput.slice(HANDLE_OPS_SELECTOR_LEN);
  if (args.length < WORD) return null;

  let arrayOffset = wordToBigInt(readWord(args, 0)).toI32();
  if (arrayOffset < 0 || arrayOffset + WORD > args.length) return null;

  let arrayLen = wordToBigInt(readWord(args, arrayOffset)).toI32();
  let arrayDataStart = arrayOffset + WORD;

  for (let i = 0; i < arrayLen; i++) {
    let elemOffsetPos = arrayDataStart + i * WORD;
    if (elemOffsetPos + WORD > args.length) return null;
    let elemOffset = wordToBigInt(readWord(args, elemOffsetPos)).toI32();
    let tupleStart = arrayDataStart + elemOffset;
    if (tupleStart + 11 * WORD > args.length) return null;

    let opSender = wordToAddress(readWord(args, tupleStart));
    let opNonce = wordToBigInt(readWord(args, tupleStart + WORD));
    if (!opSender.equals(expectedSender) || !opNonce.equals(expectedNonce)) continue;

    // Field index 3 (0-based) of the 11-field UserOperation tuple = callData,
    // encoded as an offset relative to tupleStart.
    let callDataOffset = wordToBigInt(readWord(args, tupleStart + 3 * WORD)).toI32();
    let callDataAbs = tupleStart + callDataOffset;
    if (callDataAbs + WORD > args.length) return null;
    let callDataLen = wordToBigInt(readWord(args, callDataAbs)).toI32();
    if (callDataAbs + WORD + callDataLen > args.length) return null;
    let callData = args.slice(callDataAbs + WORD, callDataAbs + WORD + callDataLen);

    if (callData.length < EXECUTE_SELECTOR_LEN + WORD * 2) return null;
    let executeArgs = callData.slice(EXECUTE_SELECTOR_LEN);
    // execute(address dest, uint256 value, bytes func) — dest and value are
    // both static-width words, always first regardless of func's contents.
    let vendor = wordToAddress(readWord(executeArgs, 0));
    let amount = wordToBigInt(readWord(executeArgs, WORD));
    return new ExecuteCall(vendor, amount);
  }
  return null;
}

export function handleUserOperationEvent(event: UserOperationEventEvent): void {
  let op = new UserOperation(event.params.userOpHash.toHexString());
  op.sender = event.params.sender;
  op.paymaster = event.params.paymaster;
  op.nonce = event.params.nonce;
  op.success = event.params.success;
  op.actualGasCost = event.params.actualGasCost;
  op.actualGasUsed = event.params.actualGasUsed;
  op.blockNumber = event.block.number;
  op.blockTimestamp = event.block.timestamp;
  op.transactionHash = event.transaction.hash;
  op.debugInputLen = event.transaction.input.length;

  let call = decodeVendorPayment(event.transaction.input, event.params.sender, event.params.nonce);
  op.debugStage = call != null ? "success" : "decode_failed_or_no_match";

  if (call != null) {
    op.vendor = call.vendor;
    op.amount = call.amount;

    let vendorId = call.vendor.toHexString();
    let rep = VendorReputation.load(vendorId);
    if (rep == null) {
      rep = new VendorReputation(vendorId);
      rep.totalOps = BigInt.fromI32(0);
      rep.successCount = BigInt.fromI32(0);
      rep.failureCount = BigInt.fromI32(0);
      rep.successRate = BigDecimal.fromString("0");
      rep.totalPaidWei = BigInt.fromI32(0);
    }
    rep.totalOps = rep.totalOps.plus(BigInt.fromI32(1));
    if (event.params.success) {
      rep.successCount = rep.successCount.plus(BigInt.fromI32(1));
      rep.totalPaidWei = rep.totalPaidWei.plus(call.amount);
    } else {
      rep.failureCount = rep.failureCount.plus(BigInt.fromI32(1));
    }
    rep.successRate = rep.successCount
      .toBigDecimal()
      .times(BigDecimal.fromString("100"))
      .div(rep.totalOps.toBigDecimal());
    rep.lastUpdatedAt = event.block.timestamp;
    rep.save();
  }

  op.save();
}
