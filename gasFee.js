
import { Api, TonApiClient } from '@ton-api/client';
import { storeMessageRelaxed,WalletContractV4 , WalletContractV5R1 } from '@ton/ton';
import { Address, beginCell, internal, toNano, SendMode, external, storeMessage } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { ContractAdapter } from '@ton-api/ton-adapter';

// const endpoint = await getHttpEndpoint({ network: "testnet" });
const http = new TonApiClient({ baseUrl: 'https://testnet.tonapi.io' });
const client = new Api(http);
const provider = new ContractAdapter(client);

const OP_CODES = {
    TK_RELAYER_FEE: 0x878da6e3,
    JETTON_TRANSFER: 0xf8a7ea5
};

// Amount for jetton transfer. Usually 0.05 TON is enough for most jetton transfers without forwardBody
const BASE_JETTON_SEND_AMOUNT = toNano(0.05);

export const gasFee = async () => {
    try {
        const mnemonic = process.env.KEY;
        const destination = Address.parse('0QDZCwEV1RTaskFt1c1VJg1EP36jejpxyd8l0WSX0wI9Zz4p'); // replace with a correct recipient address
        const usdtMaster = Address.parse('kQC4WkAmmvA-icRQB3mHfLKIKIgA7CuV3vnFXptTSbV-Y1S6'); // USDt jetton master.

        const jettonAmount = 1_000_000n; // amount in nanocoins. 1 USDt.

        const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
        const workChain = 0;
        const wallet = WalletContractV5R1.create({ workChain, publicKey: keyPair.publicKey });
        const contract = provider.open(wallet);

        console.log('Wallet address:', wallet.getBalance());

        const jettonWalletAddressResult = await client.blockchain.execGetMethodForBlockchainAccount(
            usdtMaster,
            'get_wallet_address',
            {
                args: [wallet.address.toRawString()]
            }
        );

        const jettonWallet = Address.parse(jettonWalletAddressResult.decoded.jettonWalletAddress);

        console.log("Jetton Wallet" , jettonWallet)

        const relayerAddress = await printConfigAndReturnRelayAddress();


        // Create payload for jetton transfer
        const tetherTransferPayload = beginCell()
            .storeUint(OP_CODES.JETTON_TRANSFER, 32)
            .storeUint(0, 64)
            .storeCoins(jettonAmount) // 1 USDT
            .storeAddress(destination) // address for receiver
            .storeAddress(relayerAddress) // address for excesses
            .storeBit(false) // null custom_payload
            .storeCoins(1n) // count of forward transfers in nanoton
            .storeMaybeRef(undefined)
            .endCell();
           
        const messageToEstimate = beginCell()
            .storeWritable(
                storeMessageRelaxed(
                    internal({
                        to: jettonWallet,
                        bounce: true,
                        value: BASE_JETTON_SEND_AMOUNT,
                        body: tetherTransferPayload
                    })
                )
            )
            .endCell();
         
           
        const params = await client.gasless.gaslessEstimate(usdtMaster, {
            walletAddress: wallet.address,
            walletPublicKey: keyPair.publicKey.toString('hex'),
            messages: [
                {
                    boc: messageToEstimate
                }
            ]
        });
  
        console.log('Estimated transfer:', params);

        const seqno = await contract.getSeqno();

        const tetherTransferForSend = wallet.createTransfer({
            seqno,
            authType: 'internal',
            timeout: Math.ceil(Date.now() / 1000) + 5 * 60,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            messages: params.messages.map(message =>
                internal({
                    to: message.address,
                    value: BigInt(message.amount),
                    body: message.payload
                })
            )
        });

        const extMessage = beginCell()
            .storeWritable(
                storeMessage(
                    external({
                        to: contract.address,
                        init: seqno === 0 ? contract.init : undefined,
                        body: tetherTransferForSend
                    })
                )
            )
            .endCell();

        // Send a gasless transfer
        await client.gasless
            .gaslessSend({
                walletPublicKey: keyPair.publicKey.toString('hex'),
                boc: extMessage
            });

        console.log('A gasless transfer sent!');

    } catch (error) {
        console.error('An error occurred:', error);
        if (error instanceof RangeError) {
            console.error('A RangeError occurred:', error);
        }
    }
};


async function printConfigAndReturnRelayAddress() {
    const cfg = await client.gasless.gaslessConfig();

    console.log('Available jettons for gasless transfer');
    console.log(cfg.gasJettons.map(gasJetton => gasJetton.masterId));

    console.log(`Relay address to send fees to: ${cfg.relayAddress}`);
    return cfg.relayAddress;
}

// import { WalletContractV4, toNano, internal, SendMode } from '@ton/core';
// import { mnemonicToPrivateKey } from '@ton/crypto';

// // Function to send TON directly
// export async function gasFee() {
//     constmnemonic=process.env.KEY
//     const recipientAddress="0QDZCwEV1RTaskFt1c1VJg1EP36jejpxyd8l0WSX0wI9Zz4p"
//     const amountInTON=0.6
//     const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));
//     const wallet = WalletContractV4.create({ workChain: 0, publicKey: keyPair.publicKey });

//     const seqno = await wallet.getSeqno();

//     const transfer = wallet.createTransfer({
//         seqno,
//         secretKey: keyPair.secretKey,
//         sendMode: SendMode.PAY_GAS_SEPARATELY, // Ensure gas fees are paid
//         messages: [
//             internal({
//                 to: recipientAddress,
//                 value: toNano(amountInTON), // Convert TON to nanoton for precision
//                 bounce: false, // Set to false if the recipient is a simple wallet
//             }),
//         ],
//     });

//     await wallet.sendTransfer(transfer);
//     console.log(`Sent ${amountInTON} TON to ${recipientAddress}`);
// }



