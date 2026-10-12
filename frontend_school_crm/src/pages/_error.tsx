import * as Sentry from "@sentry/nextjs";
import type { NextPage, NextPageContext } from "next";
import NextErrorComponent from "next/error";

type Props = {
  statusCode: number;
};

const CustomErrorPage: NextPage<Props> = ({ statusCode }) => (
  <NextErrorComponent statusCode={statusCode} />
);

CustomErrorPage.getInitialProps = async (ctx: NextPageContext) => {
  // Capture the error in Sentry before rendering the fallback.
  await Sentry.captureUnderscoreErrorException(ctx);
  return NextErrorComponent.getInitialProps(ctx);
};

export default CustomErrorPage;
