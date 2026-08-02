if (!URL.createObjectURL) {
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:test",
  });
}

if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => undefined,
  });
}
