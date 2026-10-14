import React from "react";
import { CheckoutModal, type CheckoutModalProps } from "./CheckoutModal";

export type SolanaPayCheckoutModalProps = CheckoutModalProps;

export function SolanaPayCheckoutModal(props: SolanaPayCheckoutModalProps) {
  return <CheckoutModal {...props} />;
}

export default SolanaPayCheckoutModal;
