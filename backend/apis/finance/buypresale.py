from fastapi import APIRouter, HTTPException, Request, Depends
import logging
from utils.web3mongo import w3, token_sale_contract
from utils.auth.session import verify_session
from eth_account.messages import encode_defunct
from decimal import Decimal, InvalidOperation, ROUND_DOWN
import os

router = APIRouter()
logger = logging.getLogger(__name__)


CHAIN_ID = int(os.getenv('CHAIN_ID'))

@router.post("/presale/buy")
async def build_buy_presale_tx(request: Request, user: dict = Depends(verify_session)):
    """
    Construye la transacción buyPreSaleTokens para que el frontend la firme y envíe.
    Valida que la wallet corresponde a la sesión.
    """
    try:
        data = await request.json()
        presale_id = data.get("presale_id")
        amount = data.get("amount")
        wallet = data.get("wallet")
        signature = data.get("signature")
        plainData = data.get("plainData")
        # (Opcional) Puedes agregar validación de payment_token, firma, etc.

        # 1. Obtener address del payment token y sus decimales (ajusta según tu modelo)
        # Aquí asumo que tienes una función o acceso a la base de datos para obtener el payment token address y decimales
        payment_token_address = None
        try:
            from utils.web3mongo import db
            presale = db.companies.find_one({f"presales.{presale_id}": {"$exists": True}}, {f"presales.{presale_id}": 1})
            if presale and "presales" in presale and str(presale_id) in presale["presales"]:
                payment_token_info = presale["presales"][str(presale_id)].get("paymentToken")
                if payment_token_info:
                    payment_token_address = payment_token_info.get("address")
        except Exception as e:
            logger.warning(f"[buy_presale] No se pudo obtener payment token: {e}")
        if not payment_token_address:
            raise HTTPException(status_code=400, detail="No se encontró el payment token para la presale indicada.")
        # Obtener los decimales del contrato ERC20
        erc20_abi_min = [
            {
                "constant": True,
                "inputs": [],
                "name": "decimals",
                "outputs": [{"name": "", "type": "uint8"}],
                "payable": False,
                "stateMutability": "view",
                "type": "function"
            }
        ]
        payment_token_decimals = 18 
        try:
            amount_decimal = Decimal(str(amount))
            factor = Decimal(10) ** int(payment_token_decimals)
            amount_base_units = int((amount_decimal * factor).to_integral_value(rounding=ROUND_DOWN))
        except Exception as e:
            logger.warning(f"[buy_presale] Error al convertir amount a base units: {e}")
            raise HTTPException(status_code=400, detail="Error al convertir amount a base units")

        # Validar que la wallet corresponde al usuario autenticado
        if user["wallet"].lower() != wallet.lower():
            raise HTTPException(status_code=403, detail="La wallet no coincide con la sesión")
        # Validar la firma del usuario
        if not signature or not plainData:
            raise HTTPException(status_code=400, detail="Faltan datos de firma (signature/plainData)")
        message = encode_defunct(text=plainData)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        if recovered.lower() != wallet.lower():
            raise HTTPException(status_code=403, detail="La firma no corresponde a la wallet")
        wallet = w3.to_checksum_address(wallet)

        # Estimar gas y construir transacción
        try:
            estimated_gas = token_sale_contract.functions.buyPreSaleTokens(
                int(presale_id),
                amount_base_units
            ).estimate_gas({"from": wallet})
            gas_with_margin = int(estimated_gas * 1.5)
        except Exception as e:
            logger.warning(f"[buy_presale] Gas estimation failed, using 600000. Error: {e}. Params: presale_id={presale_id}, amount_base_units={amount_base_units}, wallet={wallet}")
            gas_with_margin = 2500000

        tx = token_sale_contract.functions.buyPreSaleTokens(
            int(presale_id),
            amount_base_units
        ).build_transaction({
            "from": wallet,
            "nonce": w3.eth.get_transaction_count(wallet),
            "gas": gas_with_margin,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        })

        tx_clean = {
            "from": tx["from"],
            "to": tx["to"],
            "data": tx["data"],
            "nonce": tx["nonce"],
            "gas": hex(tx["gas"]),
            "gasPrice": hex(tx["gasPrice"]),
            "chainId": tx["chainId"]
        }

        return {
            "success": True,
            "msg": "Transacción de compra de presale construida. Firma y envía desde tu wallet.",
            "tx": tx_clean
        }
    except Exception as e:
        logger.error(f"[buy_presale] Error building buy presale tx: {e}")
        raise HTTPException(status_code=500, detail=f"Error building buy presale tx: {str(e)}")
