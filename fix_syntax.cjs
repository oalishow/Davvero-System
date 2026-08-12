const fs = require('fs');
let file = fs.readFileSync('src/components/StudentPortal.tsx', 'utf8');

// I will look for the end of certificates block and properly close the div.
const search = `                        </div>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === "academic" && (`;

const replace = `                        </div>
                      </div>
                    </div>
                  </>
                </div>
              </motion.div>
            )}

            {activeTab === "academic" && (`;

file = file.replace(search, replace);

fs.writeFileSync('src/components/StudentPortal.tsx', file);
