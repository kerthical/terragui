/** @type {import('next').NextConfig} */
export default {
  logging: false,
  devIndicators: false,
  turbopack: {
    rules: {
      "*.svg": {
        loaders: [
          {
            loader: "@svgr/webpack",
            options: {
              dimensions: true,
              icon: true,
              ref: true,
              memo: true,
              titleProp: true,
              descProp: true,
              expandProps: "end",
              exportType: "default",
            },
          },
        ],
        as: "*.js",
      },
    },
  },
};
