module.exports = {
  hooks: {
    readPackage(pkg) {
      // Permitir build scripts para pacotes críticos
      if (pkg.name === 'bcrypt' || pkg.name === 'esbuild' || pkg.name === '@tailwindcss/oxide') {
        pkg.scripts = pkg.scripts || {};
      }
      return pkg;
    }
  }
};
