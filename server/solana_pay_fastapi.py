"""
TokenForge Solana Pay Integration - FastAPI Backend
----------------------------------------------------
Production-ready backend for accepting Solana Pay payments directly on Solana Devnet,
using Helius RPC without traditional payment gateways or bank accounts.

Merchant Solana Public Key: 8hYwznReXFgmLcvUEg6KRoPqRmdiZU6WBRqSBqk9arYm
Solana RPC URL: https://devnet.helius-rpc.com/
Network: Solana Devnet
Accepted Asset: Devnet SOL (for testing)

Refer to /solana_pay_fastapi.py at the project root for execution.
"""
from solana_pay_fastapi import app

__all__ = ["app"]
