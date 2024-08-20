import { Api, TonApiClient } from "@ton-api/client";
import { WalletContractV4, WalletContractV5R1 } from "@ton/ton";
import { Address, toNano, SendMode } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { ContractAdapter } from "@ton-api/ton-adapter";

// const endpoint = await getHttpEndpoint({ network: "testnet" });
const http = new TonApiClient({ baseUrl: "https://testnet.tonapi.io" });
const client = new Api(http);
const provider = new ContractAdapter(client);

const OP_CODES = {
  TK_RELAYER_FEE: 0x878da6e3,
  JETTON_TRANSFER: 0xf8a7ea5,
};

// Amount for jetton transfer. Usually 0.05 TON is enough for most jetton transfers without forwardBody
const BASE_JETTON_SEND_AMOUNT = toNano(0.05);

export const gasFee = async () => {
  try {
    const mnemonic = "";
    const destination = Address.parse(
      "0QDZCwEV1RTaskFt1c1VJg1EP36jejpxyd8l0WSX0wI9Zz4p"
    ); // replace with a correct recipient address
    const usdtMaster = Address.parse(
      "kQC4WkAmmvA-icRQB3mHfLKIKIgA7CuV3vnFXptTSbV-Y1S6"
    ); // USDt jetton master.

    const jettonAmount = 1_000_000n; // amount in nanocoins. 1 USDt.

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
    const workChain = 0;

    const wallet = WalletContractV4.create({
      workchain: workChain,
      publicKey: keyPair.publicKey,
    });

    const contract = provider.open(wallet);

    console.log(contract.address);
    console.log(await contract.getBalance());
    const seqno = await contract.getSeqno();

    const params = {
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        {
          address: destination.toRawString(),
          amount: "100000000",
        },
      ],
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      timeout: 3000,
    };

    console.log("Estimated transfer:", params);

    const tetherTransferForSend = await contract.sendTransfer(params);

    console.log("A gasless transfer sent!", tetherTransferForSend);
  } catch (error) {
    console.error("An error occurred:", error);
    if (error instanceof RangeError) {
      console.error("A RangeError occurred:", error);
    }
  }
};

async function printConfigAndReturnRelayAddress() {
  const cfg = await client.gasless.gaslessConfig();

  console.log("Available jettons for gasless transfer");
  console.log(cfg.gasJettons.map((gasJetton) => gasJetton.masterId));

  console.log(`Relay address to send fees to: ${cfg.relayAddress}`);
  return cfg.relayAddress;
}
