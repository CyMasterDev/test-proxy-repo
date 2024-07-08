import Head from "./components/head";

function Error() {
  return (
    <>
        <Head defaultTitle="Error" />
        <div class="errorTitle">404 Error</div>
        <div class="errorText">This page does not exist! Or the requested URL/page could not be found. This error can also appear if you are using an insecure browser or opening Midnight inside of itself or another proxy. <a href="/">Go back to the Homepage</a></div>
    </>
  );
}

export default Error;
